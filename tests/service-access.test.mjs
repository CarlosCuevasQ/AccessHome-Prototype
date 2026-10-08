import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { installSharedSchema } from './helpers/shared-sql-fixture.mjs'

const db=new PGlite({extensions:{pgcrypto}})
const users=Object.fromEntries(['admin','daniel','ana','guard','guard2','other','otherAdmin'].map(name=>[name,randomUUID()]))
let seed,foreignHouse
async function actor(user,fn,metadata={}) {
 return db.transaction(async tx=>{
  await tx.exec('set local role '+(user?'authenticated':'anon'))
  await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:users[user],is_anonymous:false,...metadata})])
  return fn(tx)
 })
}
const call=(user,sql,args=[])=>actor(user,async tx=>(await tx.query(sql,args)).rows[0].data)
const input=extra=>({category:'paqueteria',company:'Amazon',residenceId:seed.residence24,providerName:'',plates:'PKG-24',notes:'Un paquete',...extra})
const command=(operation,target=null,data={},user='guard',request=randomUUID())=>call(user,'select accesshome.service_command($1,$2,$3,$4) as data',[operation,target,JSON.stringify(data),request])
const register=(extra={},request=randomUUID())=>command('register',null,input(extra),'guard',request)
const list=(user='guard',filter='todos',page=0)=>call(user,'select accesshome.list_services($1,$2) as data',[filter,page])
const events=async id=>(await db.query('select * from accesshome.service_events where service_id=$1 order by occurred_at,id',[id])).rows
const expire=id=>db.query("update accesshome.service_visits set registered_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where id=$1",[id])
before(async()=>{
 await installSharedSchema(db)
 for(const id of Object.values(users)) await db.query('insert into auth.users values($1)',[id])
 seed=(await db.query('select accesshome_private.seed_demo($1) as data',[JSON.stringify({admin:users.admin,daniel:users.daniel,ana:users.ana})])).rows[0].data
 for(const name of ['guard','guard2']) await db.query('select accesshome_private.provision_guard($1,$2,$3)',[users[name],seed.condominiumId,'Guardia '+name])
 const other=(await db.query("insert into accesshome.condominiums(name) values('Otro') returning id")).rows[0].id
 await db.query('select accesshome_private.provision_guard($1,$2,$3)',[users.other,other,'Guardia ajeno'])
 await db.query("insert into accesshome.profiles(user_id,condominium_id,display_name,role) values($1,$2,'Otro admin','admin')",[users.otherAdmin,other])
 foreignHouse=(await db.query("insert into accesshome.residences(condominium_id,number,street) values($1,24,'Otra calle') returning id",[other])).rows[0].id
})
after(()=>db.close())

test('Amazon a Casa 24: registrar NO da entrada; decisión explícita y salida, historial administrativo separado',async()=>{
 const {record:v}=await register()
 assert.equal(v.status,'registrado');assert.equal(v.company,'Amazon');assert.equal(v.residenceName,'Casa 24')
 assert.deepEqual(v.events.map(e=>e.operation),['register'])
 assert.equal(v.events[0].method,null);assert.equal(v.events[0].actorName,'Guardia guard')
 assert.equal(Date.parse(v.expiresAt)-Date.parse(v.registeredAt),30*60000)
 assert.equal((await db.query('select count(*)::int as n from accesshome.access_records')).rows[0].n,0)
 const allowed=await command('allow',v.id)
 assert.equal(allowed.record.status,'en_sitio')
 assert.deepEqual(allowed.record.events.map(e=>e.operation),['register','allow'])
 const exit=await command('exit',v.id,{},'guard2')
 assert.equal(exit.record.status,'finalizado')
 assert.deepEqual(exit.record.events.map(e=>e.operation),['register','allow','exit'])
 const rows=await events(v.id)
 assert.equal(rows[1].actor_id,users.guard);assert.equal(rows[2].actor_id,users.guard2)
 assert.equal(rows[1].method,'MANUAL');assert.equal(rows[2].method,'MANUAL')
 assert.equal(new Date(rows[2].occurred_at).toISOString(),new Date(exit.record.events[2].occurredAt).toISOString())
 const audit=(await list('admin')).records.find(r=>r.id===v.id)
 assert.deepEqual(audit,exit.record)
 assert.deepEqual(await call('admin','select accesshome.list_access() as data'),[])
 await assert.rejects(command('allow',v.id),/decisión/)
 await assert.rejects(command('exit',v.id),/entrada abierta/)
})

for(const [operation,status] of [['reject','rechazado'],['cancel','cancelado']]) {
 test(operation+': conserva llegada y decisión, no entrada ni reutilización',async()=>{
  const {record:v}=await register()
  const data=operation==='reject'?{reason:'Destino no coincide'}:{}
  const result=await command(operation,v.id,data)
  assert.equal(result.record.status,status)
  assert.deepEqual(result.record.events.map(e=>e.operation),['register',operation])
  assert.equal(result.record.events[1].reason,data.reason??'')
  assert.equal(result.record.events[1].method,null)
  for(const next of ['allow','reject','cancel','exit']) await assert.rejects(command(next,v.id),/decisión|entrada abierta/)
  assert.equal((await events(v.id)).length,2)
 })
}

test('vencida sin entrada rechazada; servicio dentro sale vencido sin extender fechas, incluso casa desactivada',async()=>{
 const {record:v}=await register();await expire(v.id)
 await assert.rejects(command('allow',v.id),/vencido/)
 await assert.rejects(command('exit',v.id),/entrada abierta/)
 assert.equal((await events(v.id)).length,1)
 const {record:inside}=await register();await command('allow',inside.id);await expire(inside.id)
 const before=(await db.query('select expires_at from accesshome.service_visits where id=$1',[inside.id])).rows[0].expires_at
 await db.query('update accesshome.residences set active=false where id=$1',[seed.residence24])
 try { assert.equal((await command('exit',inside.id)).record.status,'finalizado') }
 finally {await db.query('update accesshome.residences set active=true where id=$1',[seed.residence24])}
 assert.deepEqual((await db.query('select expires_at from accesshome.service_visits where id=$1',[inside.id])).rows[0].expires_at,before)
 assert.equal((await list()).records.find(r=>r.id===v.id).expired,true)
})

test('salida sin entrada y entrada duplicada rechazadas sin eventos ficticios',async()=>{
 const {record:v}=await register()
 await assert.rejects(command('exit',v.id),/entrada abierta/)
 await command('allow',v.id)
 await assert.rejects(command('allow',v.id),/decisión/)
 assert.deepEqual((await events(v.id)).map(e=>e.operation),['register','allow'])
})

test('idempotencia de llegada, decisión y salida; request no puede cambiar actor/servicio/operación/datos',async()=>{
 const request=randomUUID(),first=await register({},request),id=first.record.id
 assert.deepEqual(await register({},request),{...first,replayed:true})
 await assert.rejects(register({company:'Otra'},request),/operación no disponible/)
 await assert.rejects(command('register',null,input(),'guard2',request),/operación no disponible/)
 await assert.rejects(command('allow',id,{},'guard',request),/operación no disponible/)
 const allowId=randomUUID(),allowed=await command('allow',id,{},'guard',allowId)
 assert.deepEqual(await command('allow',id,{},'guard',allowId),{...allowed,replayed:true})
 const {record:other}=await register()
 await assert.rejects(command('allow',other.id,{},'guard',allowId),/operación no disponible/)
 const exitId=randomUUID(),exit=await command('exit',id,{},'guard',exitId)
 assert.deepEqual(await command('exit',id,{},'guard',exitId),{...exit,replayed:true})
 const oldReplay=await command('allow',id,{},'guard',allowId)
 assert.equal(oldReplay.replayed,true);assert.equal(oldReplay.record.status,'finalizado') // Never advertise a fresh entry.
 assert.equal((await events(id)).length,3)
})

test('contexto: solo residencias activas del condominio; sin nombres de residentes ni datos privados',async()=>{
 await db.query("update accesshome.residences set active=false where condominium_id=$1 and id<>$2",[seed.condominiumId,seed.residence24])
 const ctx=await call('guard','select accesshome.service_context() as data')
 assert.deepEqual(ctx,{residences:[{id:seed.residence24,name:'Casa 24'}]})
 await assert.rejects(register({residenceId:foreignHouse}),/Residencia activa/)
 const {record:v}=await register()
 await db.query('update accesshome.residences set active=false where id=$1',[seed.residence24])
 try {
  await assert.rejects(register(),/Residencia activa/)
  await assert.rejects(command('allow',v.id),/inactiva/)
 } finally { await db.query('update accesshome.residences set active=true where condominium_id=$1',[seed.condominiumId]) }
})

test('guardia ajeno, residente, visitante, admin e inactivo no pueden mutar; RLS no concede escritura directa',async()=>{
 const {record:v}=await register()
 assert.deepEqual((await list('other')).records,[])
 assert.deepEqual((await list('otherAdmin')).records,[])
 await assert.rejects(command('allow',v.id,{},'other'),/Servicio no disponible/)
 for(const user of [null,'daniel','ana','admin']) {
  await assert.rejects(command('register',null,input(),user),/permission denied|Solo un guardia/)
  await assert.rejects(command('allow',v.id,{},user),/permission denied|Solo un guardia/)
  await assert.rejects(call(user,'select accesshome_private.service_command($1,$2,$3,$4) as data',['allow',v.id,'{}',randomUUID()]),/permission denied|Solo un guardia/)
  await assert.rejects(call(user,'select accesshome.service_context() as data'),/permission denied|Solo un guardia/)
  if(user!=='admin') await assert.rejects(list(user),/permission denied|permiso/)
 }
 await assert.rejects(actor('daniel',tx=>tx.query("select accesshome.service_command('allow',$1,'{}',$2)",[v.id,randomUUID()]),{user_metadata:{role:'guard'}}),/Solo un guardia/)
 await assert.rejects(actor('guard',tx=>tx.query('select accesshome.service_context()'),{is_anonymous:true}),/Solo un guardia/)
 await db.query('select accesshome_private.set_guard_active($1,$2,false)',[users.guard,seed.condominiumId])
 try {await assert.rejects(command('allow',v.id),/Solo un guardia/);await assert.rejects(list(),/permiso/)}
 finally {await db.query('select accesshome_private.set_guard_active($1,$2,true)',[users.guard,seed.condominiumId])}
 for(const table of ['service_visits','service_events']) {
  for(const user of ['guard','daniel','otherAdmin']) assert.equal((await actor(user,tx=>tx.query('select * from accesshome.'+table))).rows.length,0)
  for(const user of ['guard','admin','daniel']) {
   await assert.rejects(actor(user,tx=>tx.query('delete from accesshome.'+table)),/permission denied/)
   await assert.rejects(actor(user,tx=>tx.query('update accesshome.'+table+' set id=gen_random_uuid()')),/permission denied/)
   await assert.rejects(actor(user,tx=>tx.query('insert into accesshome.'+table+'(id) values(gen_random_uuid())')),/permission denied/)
  }
 }
})

test('rechaza autoridad y datos inválidos; mantenimiento/otro requieren nombre, empresa no da entrada',async()=>{
 for(const bad of [{authorized:true},{status:'en_sitio'},{condominiumId:seed.condominiumId},{registeredBy:users.guard2},
  {category:'permanente'},{category:'mantenimiento'},{category:'otro'},{plates:'<invalid>'},{notes:'x'.repeat(241)},{company:'x'.repeat(81)},{providerName:42}]) {
  await assert.rejects(register(bad))
 }
 for(const category of ['paqueteria','comida','transporte','mantenimiento','otro']) {
  const result=await register({category,company:'Uber',providerName:'Prestador'})
  assert.equal(result.record.status,'registrado');assert.equal(result.record.events.length,1)
 }
 const {record:v}=await register()
 await assert.rejects(command('allow',v.id,{authorized:true}),/Campos/)
 await assert.rejects(command('allow',v.id,{},'guard',null),/Operación/)
 await assert.rejects(command('unknown',v.id),/Operación/)
})

test('errores revierten estado/eventos juntos; nombres de guardias son snapshots',async()=>{
 const {record:v}=await register()
 await db.exec("create function accesshome_private.fixture_service_failure() returns trigger language plpgsql as $$ begin raise exception 'fixture failure'; end $$; create trigger fixture_service_failure before insert on accesshome.service_events for each row execute function accesshome_private.fixture_service_failure();")
 try {await assert.rejects(command('allow',v.id),/fixture failure/)}
 finally {await db.exec('drop trigger fixture_service_failure on accesshome.service_events; drop function accesshome_private.fixture_service_failure();')}
 assert.equal((await list()).records.find(r=>r.id===v.id).status,'registrado')
 assert.equal((await events(v.id)).length,1)
 await command('reject',v.id,{reason:'Sin servicio confirmado'})
 await db.query("update accesshome.profiles set display_name='Nombre actualizado' where user_id=$1",[users.guard])
 try {assert.ok((await list('admin')).records.find(r=>r.id===v.id).events.every(e=>e.actorName==='Guardia guard'))}
 finally {await db.query("update accesshome.profiles set display_name='Guardia guard' where user_id=$1",[users.guard])}
})

test('listado paginado y cola en sitio contienen solo sus estados, sin request_id ni parámetros internos',async()=>{
 for(let n=0;n<51;n++) await register({company:'Página '+n})
 const a=await list('admin','registrado',0),b=await list('admin','registrado',1)
 assert.equal(a.records.length,50);assert.equal(a.hasMore,true)
 const ids=[...a.records,...b.records].map(v=>v.id)
 assert.equal(ids.length,new Set(ids).size)
 for(const v of a.records) {assert.equal(v.status,'registrado');assert.ok(v.events.every(e=>!('request_id' in e)&&!('command_input' in e)))}
 const queue=await list('guard','en_sitio')
 assert.ok(queue.records.every(v=>v.status==='en_sitio' && v.events.some(e=>e.operation==='allow') && !v.events.some(e=>e.operation==='exit')))
 for(const [state,page] of [['x',0],['todos',-1],['todos',10001],['todos',null]]) await assert.rejects(list('guard',state,page),/Filtros/)
})
