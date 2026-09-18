import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { before, after, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { installSharedSchema } from './helpers/shared-sql-fixture.mjs'

const db = new PGlite({ extensions: { pgcrypto } })
const users = Object.fromEntries(['admin','daniel','ana','guard','otherGuard','unassigned'].map(name => [name, randomUUID()]))
let seed, otherCondo, beforeUpgrade, afterUpgrade, afterSharing, pendingId, completedId, oldId
async function actor(name, fn, metadata = {}) {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${name ? 'authenticated' : 'anon'}`)
    await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: users[name], is_anonymous: false, ...metadata })])
    return fn(tx)
  })
}
const call = (name, rpc, args = [], casts = []) => actor(name, tx => tx.query(
  `select accesshome.${rpc}(${args.map((_, i) => '$'+(i+1)+(casts[i] ? '::'+casts[i] : '')).join(',')}) as data`, args).then(r => r.rows[0].data))
const provision = (id, condo, name) => db.query('select accesshome_private.provision_guard($1,$2,$3)', [id,condo,name])
const activate = enabled => db.query('select accesshome_private.set_guard_active($1,$2,$3)',[users.guard,seed.condominiumId,enabled])
async function snapshot() {
  const tables = (await db.query("select schemaname,tablename from pg_tables where schemaname in ('accesshome','accesshome_private') order by 1,2")).rows
  const result = {}
  for(const {schemaname,tablename} of tables) result[schemaname+'.'+tablename] = (await db.query(
    `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') as data from ${schemaname}.${tablename} t`)).rows[0].data
  return result
}
async function visit(name, exit = false) {
  const id = await call('daniel','create_invitation',[JSON.stringify({source:'occasional',visitorName:name,phone:'private-phone',vehicle:{plates:'VIS-24',brand:'Privada',model:'Modelo',color:'Azul'},saveAsContact:false,validity:{kind:'24hours'}})],['jsonb'])
  const details = await call('daniel','invitation_details',[id])
  await call('admin','validate_access',[details.token,randomUUID()])
  if(exit) await call('admin','validate_access',[details.token,randomUUID()])
  return id
}
before(async () => {
  await installSharedSchema(db, {baseOnly:true})
  for(const id of Object.values(users)) await db.query('insert into auth.users values($1)',[id])
  seed = (await db.query('select accesshome_private.seed_demo($1) as data',[JSON.stringify({admin:users.admin,daniel:users.daniel,ana:users.ana})])).rows[0].data
  pendingId = await visit('Pendiente cancelada')
  await call('daniel','cancel_invitation',[pendingId])
  completedId = await visit('Visita con salida',true)
  oldId = await visit('Pendiente antigua vencida')
  await db.query("update accesshome.access_records set occurred_at=now()-interval '9 days' where invitation_id=$1",[oldId])
  await db.query("update accesshome.invitations set starts_at=now()-interval '10 days',expires_at=now()-interval '8 days' where id=$1",[oldId])
  beforeUpgrade = await snapshot()
  await db.exec(await readFile('supabase/migrations/20260917000600_guard_workspace.sql','utf8'))
  afterUpgrade = await snapshot()
  await db.exec(await readFile('supabase/migrations/20260917000700_public_invitation_sharing.sql','utf8'))
  afterSharing = await snapshot()
  otherCondo = (await db.query("insert into accesshome.condominiums(name) values('Condominio ajeno') returning id")).rows[0].id
  await provision(users.guard,seed.condominiumId,'Claudia Seguridad')
  await provision(users.otherGuard,otherCondo,'Guardia ajeno')
})
after(() => db.close())

test('incremental de caseta conserva cada fila de las ocho migraciones ya pobladas',async () => {
  assert.deepEqual(afterUpgrade,beforeUpgrade)
  assert.deepEqual(afterSharing,afterUpgrade)
  assert.equal((await call(null,'backend_health')).guardWorkspaceVersion,1)
  assert.equal((await call(null,'backend_health')).publicInvitationVersion,2)
  await db.exec(await readFile('supabase/tests/security_baseline.sql','utf8'))
})

test('provisión vincula Auth existente sin convertir perfiles ni trasladarlos',async () => {
  const profile = await call('guard','session_profile')
  assert.equal(profile.role,'guard'); assert.equal(profile.residenceId,null)
  assert.equal(profile.condominiumId,seed.condominiumId)
  await provision(users.guard,seed.condominiumId,'Claudia Seguridad')
  for(const user of ['admin','daniel']) await assert.rejects(provision(users[user],seed.condominiumId,'Cambio de rol'),/no se cambian roles/)
  await assert.rejects(provision(users.guard,otherCondo,'Claudia Seguridad'),/no se cambian roles/)
  await assert.rejects(provision(users.guard,seed.condominiumId,'Otro nombre'),/otro nombre/)
  await assert.rejects(provision(randomUUID(),seed.condominiumId,'Sin Auth'),/Primero crea/)
  await assert.rejects(provision(users.unassigned,randomUUID(),'Sin condominio'),/Condominio inexistente/)
  await assert.rejects(provision(users.unassigned,seed.condominiumId,' '),/nombre válido/)
})

test('solo el propietario puede provisionar/activar; JWT metadata no concede guard',async () => {
  for(const user of ['guard','admin','daniel','unassigned',null]) {
    await assert.rejects(actor(user,tx=>tx.query('select accesshome_private.provision_guard($1,$2,$3)',[users.unassigned,seed.condominiumId,'Intruso'])),/permission denied/)
    await assert.rejects(actor(user,tx=>tx.query('select accesshome_private.set_guard_active($1,$2,true)',[users.guard,seed.condominiumId])),/permission denied/)
    await assert.rejects(actor(user,tx=>tx.query("update accesshome.profiles set role='guard' where user_id=$1",[users[user]??users.unassigned])),/permission denied/)
  }
  await assert.rejects(actor('daniel',tx=>tx.query('select accesshome.guard_dashboard()'),{user_metadata:{role:'guard',condominium_id:seed.condominiumId}}),/Solo un guardia/)
  assert.equal(await call('unassigned','session_profile'),null)
  assert.equal((await call('daniel','session_profile')).role,'resident')
})

test('caseta muestra snapshots mínimos, pendientes cancelados/vencidos y cuenta según zona del condominio',async () => {
  // Far timezone makes the boundary different from the DB/browser timezone.
  await db.query("update accesshome.condominiums set time_zone='Pacific/Kiritimati' where id=$1",[seed.condominiumId])
  const panel = await call('guard','guard_dashboard')
  assert.equal(panel.guardName,'Claudia Seguridad')
  assert.equal(panel.condominiumName,beforeUpgrade['accesshome.condominiums'][0].name)
  assert.equal(panel.timeZone,'Pacific/Kiritimati')
  const expected = (await db.query(`select count(*)::int as n from accesshome.access_records r
    where r.condominium_id=$1 and (r.occurred_at at time zone 'Pacific/Kiritimati')::date=(now() at time zone 'Pacific/Kiritimati')::date`,[seed.condominiumId])).rows[0].n
  assert.equal(panel.todayAccessCount,expected)
  assert.equal(panel.pendingExitCount,2)
  assert.equal(panel.pendingExits[0].visitorName,'Pendiente antigua vencida')
  assert.equal(panel.recentEntries.length,3); assert.equal(panel.recentExits.length,1)
  for(const row of [...panel.recentEntries,...panel.recentExits,...panel.pendingExits]) {
    assert.deepEqual(Object.keys(row).sort(),['id','visitorName','residenceName','type','method','occurredAt','vehicle'].sort())
    assert.deepEqual(row.vehicle,{plates:'VIS-24'})
  }
})

test('caseta aislada por condominio y sin SELECT de datos privados por fuera del RPC',async () => {
  const other = await call('otherGuard','guard_dashboard')
  assert.equal(other.condominiumName,'Condominio ajeno')
  assert.equal(other.todayAccessCount,0); assert.equal(other.pendingExitCount,0)
  assert.deepEqual(other.recentEntries,[]); assert.deepEqual(other.recentExits,[])
  assert.deepEqual((await call('otherGuard','guard_history')).records,[])
  for(const table of ['residences','inhabitants','residence_vehicles','frequent_contacts','contact_vehicles','invitations','access_records','reports']) {
    assert.equal((await actor('guard',tx=>tx.query('select * from accesshome.'+table))).rows.length,0,table)
  }
  assert.equal((await actor('guard',tx=>tx.query('select * from accesshome.profiles'))).rows.length,1)
  assert.equal((await actor('guard',tx=>tx.query('select * from accesshome.condominiums'))).rows[0].id,seed.condominiumId)
  await assert.rejects(actor('guard',tx=>tx.query('select * from accesshome_private.invitation_tokens')),/permission denied/)
  for(const user of [null,'admin','daniel','unassigned']) await assert.rejects(call(user,'guard_dashboard'),/Solo un guardia|permission denied/)
  await assert.rejects(actor('guard',tx=>tx.query('select accesshome.guard_dashboard()'),{is_anonymous:true}),/Solo un guardia/)
})

test('guardia no administra, no modifica invitaciones ni accesos por RPC o SQL directo',async () => {
  const operations = [
    ['community_summary'],['admin_dashboard'],['resident_dashboard'],['list_residences'],['residence_details',[seed.residence24]],
    ['manage_community',['create_residence',null,'{}'],['text','uuid','jsonb']],
    ['assign_principal',[seed.residence24,randomUUID()]],
    ['manage_household',['create_inhabitant',seed.residence24,null,'{}'],['text','uuid','uuid','jsonb']],
    ['manage_household',['update_vehicle',seed.residence24,randomUUID(),'{}'],['text','uuid','uuid','jsonb']],
    ['list_contacts'],['manage_contact',['create',null,'{}',null],['text','uuid','jsonb','uuid']],
    ['create_invitation',['{}'],['jsonb']],['cancel_invitation',[pendingId]],['invitation_details',[completedId]],
    ['validate_access',['token',randomUUID()]],['active_access_invitations'],
    ['create_report',['{}'],['jsonb']],['advance_report',[randomUUID(),'en_proceso']],
  ]
  for(const [rpc,args,casts] of operations) await assert.rejects(call('guard',rpc,args,casts),/permiso|principal/,rpc)
  for(const table of ['profiles','residences','inhabitants','residence_vehicles','invitations','access_records']) {
    await assert.rejects(actor('guard',tx=>tx.query(`delete from accesshome.${table}`)),/permission denied/,table)
  }
  await assert.rejects(actor('guard',tx=>tx.query("update accesshome.access_records set visitor_name='Alterado'")),/permission denied/)
  await assert.rejects(actor('guard',tx=>tx.query("insert into accesshome.profiles(user_id,condominium_id,display_name,role) values($1,$2,'Intruso','guard')",[users.unassigned,seed.condominiumId])),/permission denied/)
})

test('desactivar corta consulta con el mismo JWT; reprovisionar no reactiva y activar es explícito',async () => {
  await activate(false)
  await provision(users.guard,seed.condominiumId,'Claudia Seguridad')
  assert.equal(await call('guard','session_profile'),null)
  await assert.rejects(call('guard','guard_dashboard'),/Solo un guardia/)
  await assert.rejects(call('guard','guard_history'),/Solo un guardia/)
  await assert.rejects(db.query('select accesshome_private.set_guard_active($1,$2,true)',[users.guard,otherCondo]),/no encontrado/)
  await assert.rejects(db.query('select accesshome_private.set_guard_active($1,$2,true)',[users.admin,seed.condominiumId]),/no encontrado/)
  await activate(true)
  assert.equal((await call('guard','session_profile')).role,'guard')
  assert.equal((await call('guard','guard_dashboard')).pendingExitCount,2)
})

test('historial limitado a siete días, paginado, filtrado y con parámetros validados',async () => {
  const initial = await call('guard','guard_history')
  assert.equal(initial.records.length,3)
  assert.ok(initial.records.every(r=>r.visitorName!=='Pendiente antigua vencida'))
  assert.equal((await call('guard','guard_history',['salida',0])).records.length,1)
  for(const args of [['bad',0],['',-1],['',10001],[null,0],['',null]]) await assert.rejects(call('guard','guard_history',args),/Filtros/)
  // Bulk historical fixtures only inside this disposable local database.
  await db.query(`with visits as (
    insert into accesshome.invitations(condominium_id,residence_id,inviter_user_id,visitor_name,inviter_name,residence_name,starts_at,expires_at)
    select $1,$2,$3,'Visita '||n,'Dato privado','Casa 24',now()-interval '1 hour',now()+interval '1 day' from generate_series(1,52) n returning *
  ) insert into accesshome.access_records(invitation_id,condominium_id,residence_id,inviter_user_id,source,visitor_name,residence_name,inviter_name,direction)
    select id,condominium_id,residence_id,inviter_user_id,'local_import',visitor_name,residence_name,inviter_name,'entrada' from visits`,[seed.condominiumId,seed.residence24,users.daniel])
  const first = await call('guard','guard_history',['',0]), second = await call('guard','guard_history',['',1])
  assert.equal(first.records.length,50); assert.equal(first.hasMore,true)
  assert.equal(second.records.length,5); assert.equal(second.hasMore,false)
  assert.equal(new Set([...first.records,...second.records].map(r=>r.id)).size,55)
  const panel = await call('guard','guard_dashboard')
  assert.equal(panel.recentEntries.length,5); assert.equal(panel.pendingExits.length,10)
  assert.equal(panel.pendingExitCount,54)
})
