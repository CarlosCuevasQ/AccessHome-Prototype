import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { installSharedSchema } from './helpers/shared-sql-fixture.mjs'
import { invitationQrPurpose } from '../.test-build/services/invitationQrPurpose.js'

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

const publicView=i=>call(null,'select accesshome.public_invitation($1,null) as data',[i.token])
const openVisits=(user='guard',page=0)=>call(user,'select accesshome.guard_open_visits($1) as data',[page])
const manualExit=(entryId,user='guard',request=randomUUID())=>call(user,'select accesshome.guard_register_exit($1,$2) as data',[entryId,request])

for (const state of ['cancelada','expirada']) {
 test('QR público '+state+': solo salida con entrada real, sin revelar historial',async()=>{
  const i=await invite()
  const initial=await publicView(i)
  assert.equal(initial.hasOpenEntry,false)
  assert.equal(invitationQrPurpose(initial.status,initial.hasOpenEntry),'access')
  await scan(i.token); await ageEntry(i.id)
  if(state==='cancelada') await call('daniel','select accesshome.cancel_invitation($1) as data',[i.id])
  else await db.query("update accesshome.invitations set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",[i.id])
  const projection=await publicView(i)
  assert.equal(projection.status,state); assert.equal(projection.hasOpenEntry,true)
  assert.equal(invitationQrPurpose(projection.status,projection.hasOpenEntry),'exit')
  assert.deepEqual(Object.keys(projection).sort(),['token','visitorName','residenceName','condominiumName','startsAt','expiresAt','status','hasOpenEntry'].sort())
  assert.equal(projection.token,i.token)
  const result=await scan(i.token)
  assert.equal(result.authorized,true); assert.equal(result.record.type,'salida'); assert.equal(result.record.method,'QR')
  assert.equal(result.record.invitationEffectiveStatusBefore,state)
  const final=await publicView(i)
  assert.equal(final.hasOpenEntry,false); assert.equal(final.status,'completada')
  assert.equal(invitationQrPurpose(final.status,final.hasOpenEntry),'unavailable')
  assert.equal((await scan(i.token)).reason,'completed')
  const unused=await invite()
  if(state==='cancelada') await call('daniel','select accesshome.cancel_invitation($1) as data',[unused.id])
  else await db.query("update accesshome.invitations set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",[unused.id])
  const denied=await publicView(unused)
  assert.equal(denied.hasOpenEntry,false)
  assert.equal(invitationQrPurpose(denied.status,denied.hasOpenEntry),'unavailable')
  assert.equal((await scan(unused.token)).authorized,false)
 })
}

test('presentación: backend anterior sin indicador falla cerrado; completada nunca muestra QR utilizable',()=>{
 for(const status of ['expirada','cancelada','completada']) assert.equal(invitationQrPurpose(status),'unavailable')
 assert.equal(invitationQrPurpose('completada',true),'unavailable')
 assert.equal(invitationQrPurpose('cancelada','true'),'unavailable')
})

for(const state of ['activa','cancelada','expirada']) {
 test('salida sin QR '+state+': lista, confirmación por ID, trazabilidad e idempotencia',async()=>{
  const i=await invite(), entry=await scan(i.token)
  await ageEntry(i.id)
  if(state==='cancelada') await call('daniel','select accesshome.cancel_invitation($1) as data',[i.id])
  if(state==='expirada') await db.query("update accesshome.invitations set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",[i.id])
  const before=(await db.query('select * from accesshome.invitations where id=$1',[i.id])).rows[0]
  const pending=(await openVisits()).records.find(r=>r.id===entry.record.id)
  assert.ok(pending); assert.equal(pending.visitorName,i.visitorName); assert.equal(pending.residenceName,i.residenceName)
  assert.deepEqual(Object.keys(pending).sort(),['id','visitorName','residenceName','type','method','occurredAt','vehicle'].sort())
  assert.deepEqual(pending.vehicle,{plates:i.vehicle.plates})
  const request=randomUUID(), result=await manualExit(entry.record.id,'guard',request)
  assert.equal(result.authorized,true); assert.equal(result.record.type,'salida'); assert.equal(result.record.method,'MANUAL')
  assert.equal(result.record.invitationEffectiveStatusBefore,state)
  assert.deepEqual(await manualExit(entry.record.id,'guard',request),{...result,replayed:true})
  assert.equal((await manualExit(entry.record.id)).authorized,false)
  assert.equal((await manualExit(result.record.id)).authorized,false)
  assert.equal((await openVisits()).records.some(r=>r.id===entry.record.id),false)
  const stored=await rows(i.id)
  assert.equal(stored.length,2); assert.equal(stored[1].validated_by,users.guard)
  const after=(await db.query('select * from accesshome.invitations where id=$1',[i.id])).rows[0]
  assert.deepEqual(after.starts_at,before.starts_at); assert.deepEqual(after.expires_at,before.expires_at)
  assert.equal(after.status,'completada')
  assert.equal((await publicView(i)).token,i.token)
  const history=await call('admin','select accesshome.list_access() as data')
  assert.equal(history.find(r=>r.id===result.record.id).method,'MANUAL')
  await assert.rejects(manualExit(entry.record.id,'guard2',request),/operación no disponible/)
 })
}

test('salida sin QR: autorización interna incluso al llamar la función privada, IDs y estado inválidos',async()=>{
 const i=await invite(), request=randomUUID()
 const entry=await scan(i.token,'guard',request,'MANUAL'); await ageEntry(i.id)
 for(const user of [null,'daniel','ana','admin','unassigned']) {
  await assert.rejects(openVisits(user),/permission denied|Solo un guardia/)
  await assert.rejects(manualExit(entry.record.id,user),/permission denied|Solo un guardia/)
  await assert.rejects(call(user,'select accesshome_private.guard_register_exit($1,$2) as data',[entry.record.id,randomUUID()]),/permission denied|Solo un guardia/)
 }
 assert.deepEqual((await openVisits('other')).records,[])
 assert.equal((await manualExit(entry.record.id,'other')).reason,'not_found')
 assert.equal((await manualExit(i.id)).reason,'not_found') // An invitation ID is not an entry.
 assert.equal((await manualExit(randomUUID())).reason,'not_found')
 await assert.rejects(manualExit(entry.record.id,'guard',request),/operación no disponible/) // Never replay an entry as an exit.
 await assert.rejects(manualExit(entry.record.id,'guard',null),/Identificador/)
 for(const page of [-1,10001,null]) await assert.rejects(openVisits('guard',page),/Página/)
 await db.query('select accesshome_private.set_guard_active($1,$2,false)',[users.guard,seed.condominiumId])
 try {await assert.rejects(manualExit(entry.record.id),/Solo un guardia/); await assert.rejects(openVisits(),/Solo un guardia/)}
 finally {await db.query('select accesshome_private.set_guard_active($1,$2,true)',[users.guard,seed.condominiumId])}
 assert.equal((await rows(i.id)).length,1)
 assert.equal((await manualExit(entry.record.id)).authorized,true)
})

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
  assert.equal((await publicView(i)).hasOpenEntry,false) // Ledger evidence, not a counter.
  assert.equal((await scan(i.token)).reason,'invalid_sequence')
  await db.query('update accesshome.invitations set used_uses=0 where id=$1',[i.id])
  await db.exec("create function accesshome_private.fixture_failure() returns trigger language plpgsql as $$ begin raise exception 'fixture failure'; end $$; create trigger fixture_failure before insert on accesshome.access_records for each row execute function accesshome_private.fixture_failure();")
  try { await assert.rejects(scan(i.token),/fixture failure/) }
  finally { await db.exec('drop trigger fixture_failure on accesshome.access_records; drop function accesshome_private.fixture_failure();') }
  assert.equal((await rows(i.id)).length,0)
  assert.equal((await db.query('select used_uses from accesshome.invitations where id=$1',[i.id])).rows[0].used_uses,0)
})

test('pendientes paginados incluyen visitas antiguas y nunca historial de salidas',async()=>{
 const created=[]
 for(let n=0;n<51;n++) {
  const i=await invite(), entry=await scan(i.token)
  created.push(entry.record.id)
 }
 await db.query("update accesshome.access_records set occurred_at=now()-interval '10 days' where id=$1",[created[0]])
 const first=await openVisits('guard',0),second=await openVisits('guard',1)
 assert.equal(first.records.length,50);assert.equal(first.hasMore,true);assert.equal(second.hasMore,false)
 const ids=[...first.records,...second.records].map(r=>r.id)
 assert.equal(new Set(ids).size,ids.length)
 for(const id of created) assert.ok(ids.includes(id))
 assert.ok(first.records.some(r=>r.id===created[0]))
 assert.deepEqual((await openVisits('other')).records,[])
})
