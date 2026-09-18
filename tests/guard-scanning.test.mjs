import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { installSharedSchema } from './helpers/shared-sql-fixture.mjs'

const db=new PGlite({extensions:{pgcrypto}})
const users=Object.fromEntries(['admin','daniel','ana','guard','guard2','other','unassigned'].map(name=>[name,randomUUID()]))
let seed
async function actor(name,fn,metadata={}) {
  return db.transaction(async tx=>{
    await tx.exec('set local role '+(name?'authenticated':'anon'))
    await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:users[name],is_anonymous:false,...metadata})])
    return fn(tx)
  })
}
const call=(name,sql,args=[])=>actor(name,async tx=>(await tx.query(sql,args)).rows[0].data)
const scan=(token,user='guard',request=randomUUID(),method='QR')=>call(user,'select accesshome.validate_access($1,$2,$3) as data',[token,request,method])
async function invite() {
  const id=await call('daniel','select accesshome.create_invitation($1::jsonb) as data',[JSON.stringify({source:'occasional',visitorName:'Visita de escaneo',phone:'private-phone',vehicle:{plates:'SCAN-24',brand:'Marca',model:'Modelo',color:'Azul'},saveAsContact:false,validity:{kind:'24hours'}})])
  return call('daniel','select accesshome.invitation_details($1) as data',[id])
}
const rows=async id=>(await db.query('select * from accesshome.access_records where invitation_id=$1 order by occurred_at',[id])).rows
const ageEntry=id=>db.query("update accesshome.access_records set occurred_at=clock_timestamp()-interval '4 seconds' where invitation_id=$1",[id])
before(async()=>{
  await installSharedSchema(db)
  for(const id of Object.values(users)) await db.query('insert into auth.users values($1)',[id])
  seed=(await db.query('select accesshome_private.seed_demo($1) as data',[JSON.stringify({admin:users.admin,daniel:users.daniel,ana:users.ana})])).rows[0].data
  for(const name of ['guard','guard2']) await db.query('select accesshome_private.provision_guard($1,$2,$3)',[users[name],seed.condominiumId,'Guardia '+name])
  const other=(await db.query("insert into accesshome.condominiums(name) values('Otro condominio') returning id")).rows[0].id
  await db.query('select accesshome_private.provision_guard($1,$2,$3)',[users.other,other,'Guardia ajeno'])
})
after(()=>db.close())

test('guardia: entrada, salida, método/actor/servidor persistidos y tercer intento rechazado',async()=>{
  const i=await invite()
  const entry=await scan(i.token)
  assert.equal(entry.record.type,'entrada'); assert.equal(entry.authorized,true)
  assert.equal(entry.record.validatorName,'Guardia guard')
  assert.deepEqual(entry.record.vehicle,i.vehicle)
  assert.deepEqual(Object.keys(entry.record).sort(),['id','visitorName','residenceName','vehicle','type','method','occurredAt','validatorName','invitationStatusBefore','invitationEffectiveStatusBefore'].sort())
  assert.equal(entry.record.invitationStatusBefore,'activa'); assert.equal(entry.record.invitationEffectiveStatusBefore,'activa')
  const stored=(await rows(i.id))[0]
  assert.equal(stored.validated_by,users.guard); assert.equal(stored.authorized,true)
  assert.equal(stored.invitation_id,i.id); assert.equal(stored.residence_id,seed.residence24)
  assert.equal(new Date(stored.occurred_at).getTime(),Date.parse(entry.record.occurredAt))
  await ageEntry(i.id) // Only inside this disposable fixture: no waiting clock in unit tests.
  const exit=await scan(i.token,'guard2',randomUUID(),'MANUAL')
  assert.equal(exit.record.type,'salida'); assert.equal(exit.record.method,'MANUAL')
  assert.equal(exit.status,'completada'); assert.equal((await scan(i.token)).reason,'completed')
  const records=await rows(i.id)
  assert.equal(records.length,2); assert.equal(records[1].validated_by,users.guard2)
  const history=await call('admin','select accesshome.list_access() as data')
  assert.ok(history.some(r=>r.id===entry.record.id)); assert.ok(history.some(r=>r.id===exit.record.id))
  assert.equal(history.find(r=>r.id===entry.record.id).invitationStatusBefore,'activa')
  assert.equal(history.find(r=>r.id===exit.record.id).invitationEffectiveStatusBefore,'activa')
  const publicView=await call(null,'select accesshome.public_invitation($1,null) as data',[i.token])
  assert.equal(publicView.status,'completada'); assert.equal('vehicle' in publicView,false)
})

for(const scenario of [
  ['cancelación posterior', 'cancelada'],
  ['expiración por estado', 'expirada'],
  ['expiración por fecha', 'fecha'],
]) {
 test('salida controlada después de '+scenario[0]+' conserva trazabilidad',async()=>{
  const i=await invite()
  await scan(i.token)
  await ageEntry(i.id)
  if(scenario[1]==='cancelada') await call('daniel','select accesshome.cancel_invitation($1) as data',[i.id])
  else if(scenario[1]==='expirada') await db.query("update accesshome.invitations set status='expirada',starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",[i.id])
  else await db.query("update accesshome.invitations set starts_at=now()-interval '2 days',expires_at=now()-interval '1 second' where id=$1",[i.id])
  const expected=scenario[1]==='cancelada'?'cancelada':'expirada'
  const request=randomUUID()
  const exit=await scan(i.token,'guard',request,'MANUAL')
  assert.equal(exit.authorized,true); assert.equal(exit.record.type,'salida'); assert.equal(exit.status,'completada')
  assert.equal(exit.record.invitationStatusBefore,scenario[1]==='fecha'?'activa':expected)
  assert.equal(exit.record.invitationEffectiveStatusBefore,expected)
  assert.equal((await rows(i.id)).length,2)
  assert.equal((await scan(i.token,'guard2')).reason,'completed')
  assert.deepEqual(await scan(i.token,'guard',request,'MANUAL'),{...exit,replayed:true})
 })
}

test('salida controlada solo aplica a guardia activo del mismo condominio; entrada anómala no crea salida',async()=>{
 const i=await invite()
 await db.query("update accesshome.invitations set status='cancelada' where id=$1",[i.id])
 assert.equal((await scan(i.token,'other')).reason,'not_found')
 assert.equal((await scan(i.token,'guard')).reason,'cancelled')
 const noEntry=await invite()
 await db.query("update accesshome.invitations set status='cancelada' where id=$1",[noEntry.id])
 assert.equal((await scan(noEntry.token,'guard')).reason,'cancelled')
 assert.equal((await rows(noEntry.id)).length,0)
})

test('reintento idempotente recupera el mismo movimiento; actor y método no se pueden sustituir',async()=>{
  const i=await invite(), request=randomUUID()
  const entry=await scan(i.token,'guard',request,'MANUAL')
  const repeated=await scan(i.token,'guard',request,'MANUAL')
  assert.deepEqual(repeated,{...entry,replayed:true})
  await assert.rejects(scan(i.token,'guard2',request,'MANUAL'),/operación no disponible/)
  await assert.rejects(scan(i.token,'guard',request,'QR'),/operación no disponible/)
  const other=await invite()
  await assert.rejects(scan(other.token,'guard',request,'MANUAL'),/operación no disponible/)
  assert.equal((await rows(i.id)).length,1); assert.equal((await rows(other.id)).length,0)
})

test('ráfaga de lecturas distintas no consume salida ni puede eludir el intervalo usando RPC legado',async()=>{
  const i=await invite()
  await scan(i.token)
  assert.equal((await scan(i.token,'guard2')).reason,'recent_scan')
  const legacy=await call('guard','select accesshome.validate_access($1,$2) as data',[i.token,randomUUID()])
  assert.equal(legacy.reason,'recent_scan')
  assert.equal((await rows(i.id)).length,1)
})

test('cancelada, expirada, futura, residencia inactiva y token inválido no registran movimientos',async()=>{
  for(const reason of ['cancelled','expired','outside_period','inactive_residence']) {
    const i=await invite()
    if(reason==='cancelled') await call('daniel','select accesshome.cancel_invitation($1) as data',[i.id])
    if(reason==='expired') await db.query("update accesshome.invitations set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",[i.id])
    if(reason==='outside_period') await db.query("update accesshome.invitations set starts_at=now()+interval '1 day',expires_at=now()+interval '2 days' where id=$1",[i.id])
    if(reason==='inactive_residence') await db.query('update accesshome.residences set active=false where id=$1',[seed.residence24])
    assert.equal((await scan(i.token)).reason,reason)
    assert.equal((await rows(i.id)).length,0)
    await db.query('update accesshome.residences set active=true where id=$1',[seed.residence24])
  }
  assert.equal((await scan('invalid')).reason,'not_found')
})

test('roles, condominio y actividad se autorizan en SQL sin acceso a tablas ni metadata confiable',async()=>{
  const i=await invite()
  for(const user of [null,'daniel','ana','unassigned']) await assert.rejects(scan(i.token,user),/permission denied|permiso/)
  assert.equal((await scan(i.token,'other')).reason,'not_found')
  await assert.rejects(actor('daniel',tx=>tx.query('select accesshome_private.validate_access($1,$2,$3)',[i.token,randomUUID(),'QR']),{user_metadata:{role:'guard'}}),/permiso/)
  await assert.rejects(actor('guard',tx=>tx.query('select accesshome_private.validate_access($1,$2,$3)',[i.token,randomUUID(),'QR']),{is_anonymous:true}),/permiso/)
  await db.query('select accesshome_private.set_guard_active($1,$2,false)',[users.guard,seed.condominiumId])
  await assert.rejects(scan(i.token),/permiso/)
  await db.query('select accesshome_private.set_guard_active($1,$2,true)',[users.guard,seed.condominiumId])
  await assert.rejects(scan(i.token,'guard',randomUUID(),'FORGED'),/método/)
  await assert.rejects(scan(i.token,'guard',null),/Identificador/)
  await assert.rejects(actor('guard',tx=>tx.query('update accesshome.access_records set authorized=true')),/permission denied/)
  await assert.rejects(actor('guard',tx=>tx.query("insert into accesshome.access_records(id) values(gen_random_uuid())")),/permission denied/)
  assert.equal((await rows(i.id)).length,0)
})

test('secuencia incoherente rechazada; fallo de insert revierte contador e historial juntos',async()=>{
  const i=await invite()
  await db.query('update accesshome.invitations set used_uses=1 where id=$1',[i.id])
  assert.equal((await scan(i.token)).reason,'invalid_sequence')
  await db.query('update accesshome.invitations set used_uses=0 where id=$1',[i.id])
  await db.exec("create function accesshome_private.fixture_failure() returns trigger language plpgsql as $$ begin raise exception 'fixture failure'; end $$; create trigger fixture_failure before insert on accesshome.access_records for each row execute function accesshome_private.fixture_failure();")
  try { await assert.rejects(scan(i.token),/fixture failure/) }
  finally { await db.exec('drop trigger fixture_failure on accesshome.access_records; drop function accesshome_private.fixture_failure();') }
  assert.equal((await rows(i.id)).length,0)
  assert.equal((await db.query('select used_uses from accesshome.invitations where id=$1',[i.id])).rows[0].used_uses,0)
})
