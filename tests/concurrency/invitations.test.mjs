import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import EmbeddedPostgres from 'embedded-postgres'
import { installSharedSchema } from '../helpers/shared-sql-fixture.mjs'

// No URL, credentials, .env or PG* variables are read. This suite can only
// connect to the temporary cluster it starts on IPv4 loopback.
let cluster, owner, a, b, house, contact, version
const users={admin:randomUUID(),daniel:randomUUID(),ana:randomUUID()}
const clients=[]
async function freePort() {
 const socket=createServer()
 await new Promise((yes,no)=>{ socket.once('error',no); socket.listen(0,'127.0.0.1',yes) })
 const port=socket.address().port
 await new Promise(yes=>socket.close(yes))
 return port
}
before(async()=>{
 const root=await realpath(tmpdir())
 const directory=await mkdtemp(join(root,'accesshome-pg-test-'))
 // persistent:false deletes only this newly created directory on shutdown.
 assert.equal(dirname(resolve(directory)),root)
 assert.ok(basename(directory).startsWith('accesshome-pg-test-'))
 cluster=new EmbeddedPostgres({databaseDir:directory,port:await freePort(),
  user:'postgres',password:randomBytes(32).toString('hex'),authMethod:'scram-sha-256',
  persistent:false,createPostgresUser:false,initdbFlags:['--encoding=UTF8','--locale=C'],
  postgresFlags:['-h','127.0.0.1','-c','unix_socket_directories=','-c','statement_timeout=15000','-c','lock_timeout=10000'],
  onLog:()=>{},onError:()=>{},
 })
 await cluster.initialise()
 await cluster.start()
 for(let i=0;i<3;i++) {
  const client=cluster.getPgClient('postgres','127.0.0.1')
  clients.push(client)
  await client.connect()
 }
 ;[owner,a,b]=clients
 await installSharedSchema({exec:sql=>owner.query(sql)})
 await owner.query(await readFile('supabase/tests/security_baseline.sql','utf8'))
 version=(await owner.query('show server_version')).rows[0].server_version
 for(const user of Object.values(users)) await owner.query('insert into auth.users values($1)',[user])
 house=(await owner.query('select accesshome_private.seed_demo($1) as seed',[JSON.stringify(users)])).rows[0].seed.residence24
 contact=(await owner.query('select id from accesshome.frequent_contacts order by name limit 1')).rows[0].id
}, {timeout:60000})

after(async()=>{
 await Promise.allSettled(clients.map(client=>client.end()))
 if(cluster) await cluster.stop()
})
async function begin(client,isolation='READ COMMITTED') {
 assert.ok(['READ COMMITTED','REPEATABLE READ','SERIALIZABLE'].includes(isolation))
 await client.query('begin isolation level '+isolation)
 await client.query('set local role authenticated')
 await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:users.daniel,is_anonymous:false})])
}
function input(start,end) {
 const origin=Date.UTC(2100,0,1)
 return {source:'contact',contactId:contact,vehicleChoice:{kind:'none'},validity:{kind:'custom',
  startsAt:new Date(origin+start*3600000).toISOString(),expiresAt:new Date(origin+end*3600000).toISOString()}}
}
const create=(client,payload)=>client.query('select accesshome.create_invitation($1::jsonb) as id',[JSON.stringify(payload)])
async function clearInvitations() {
 // Owner-only cleanup inside the disposable cluster, after all transactions end.
 await owner.query('delete from accesshome_private.invitation_tokens')
 await owner.query('delete from accesshome.invitations')
}
async function waitBlocked(client,blocker) {
 const deadline=Date.now()+5000
 while(Date.now()<deadline) {
  const result=await owner.query('select $2::int=any(pg_blocking_pids($1)) as blocked',[client.processID,blocker.processID])
  if(result.rows[0].blocked) return
  await delay(20)
 }
 assert.fail('La segunda conexión no llegó a bloquearse contra la primera.')
}
function settled(promise) {
 return promise.then(value=>({value}),error=>({error}))
}
async function race({second=input(10,20),rollback=false,isolation='READ COMMITTED'}={}) {
 await clearInvitations()
 let pending
 try {
  await begin(a,isolation)
  await begin(b,isolation)
  // B's transaction snapshot exists before A's insert, including at RR/SERIALIZABLE.
  await b.query('select count(*) from accesshome.invitations')
  const first=await create(a,input(10,20))
  pending=settled(create(b,second))
  await waitBlocked(b,a)
  await a.query(rollback?'rollback':'commit')
  const result=await pending
  await b.query(result.error?'rollback':'commit')
  const counts=(await owner.query(`select (select count(*)::int from accesshome.invitations) as invitations,
   (select count(*)::int from accesshome_private.invitation_tokens) as tokens`)).rows[0]
  return {first,result,counts}
 } finally {
  await a.query('rollback')
  if(pending) await pending
  await b.query('rollback')
 }
}

test('PostgreSQL nativo: doce migraciones y auditoría sin SECURITY DEFINER expuesto',t=>{
 t.diagnostic('PostgreSQL '+version+'; tres conexiones TCP locales, Auth simulado.')
 assert.notEqual(a.processID,b.processID)
})

test('dos conexiones: el segundo alta espera COMMIT y rechaza el duplicado (5 carreras)',async()=>{
 for(let n=0;n<5;n++) {
  const {result,counts}=await race()
  assert.equal(result.error?.code,'P0001')
  assert.match(result.error.message,/superpuesta/)
  assert.deepEqual(counts,{invitations:1,tokens:1})
 }
})
test('dos conexiones: un periodo parcialmente superpuesto también se rechaza',async()=>{
 const {result,counts}=await race({second:input(15,25)})
 assert.equal(result.error?.code,'P0001')
 assert.deepEqual(counts,{invitations:1,tokens:1})
})
test('dos conexiones: periodos adyacentes se confirman ambos',async()=>{
 const {result,counts}=await race({second:input(20,30)})
 assert.equal(result.error,undefined)
 assert.deepEqual(counts,{invitations:2,tokens:2})
})
test('dos conexiones: ROLLBACK del primero deja pasar la segunda invitación',async()=>{
 const {result,counts}=await race({rollback:true})
 assert.equal(result.error,undefined)
 assert.deepEqual(counts,{invitations:1,tokens:1})
})
for(const isolation of ['REPEATABLE READ','SERIALIZABLE']) {
 test('snapshot anterior en '+isolation+' aborta y no inserta duplicados',async()=>{
  const {result,counts}=await race({isolation})
  assert.equal(result.error?.code,'40001')
  assert.deepEqual(counts,{invitations:1,tokens:1})
  await begin(b,isolation)
  try { await assert.rejects(create(b,input(10,20)),error=>error.code==='P0001') }
  finally { await b.query('rollback') }
 })
}
test('cancelación concurrente: después de COMMIT el nuevo alta reutiliza el periodo',async()=>{
 await clearInvitations()
 await begin(a)
 const id=(await create(a,input(10,20))).rows[0].id
 await a.query('commit')
 let pending
 try {
  await begin(a)
  await a.query('select accesshome.cancel_invitation($1)',[id])
  await begin(b)
  pending=settled(create(b,input(10,20)))
  await waitBlocked(b,a)
  await a.query('commit')
  assert.equal((await pending).error,undefined)
  await b.query('commit')
  const rows=(await owner.query('select status,count(*)::int as n from accesshome.invitations group by status order by status')).rows
  assert.deepEqual(rows,[{status:'activa',n:1},{status:'cancelada',n:1}])
 } finally {
  await a.query('rollback')
  if(pending) await pending
  await b.query('rollback')
 }
})

test('una invitación que expira durante la espera no bloquea el alta al obtener el lock',async()=>{
 await clearInvitations()
 await begin(a)
 const id=(await create(a,input(10,20))).rows[0].id
 await a.query('commit')
 const expiry=(await owner.query(`update accesshome.invitations
  set starts_at=clock_timestamp()-interval '1 hour',expires_at=clock_timestamp()+interval '1 second'
  where id=$1 returning starts_at,expires_at`,[id])).rows[0]
 let pending
 try {
  await a.query('begin')
  await a.query('select id from accesshome.residences where id=$1 for update',[house])
  await begin(b)
  pending=settled(create(b,{...input(10,20),validity:{kind:'custom',
   startsAt:expiry.starts_at.toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()}}))
  await waitBlocked(b,a)
  await delay(Math.max(0,expiry.expires_at.getTime()-Date.now()+30))
  await a.query('commit')
  assert.equal((await pending).error,undefined)
  await b.query('commit')
  const n=(await owner.query('select count(*)::int as n from accesshome.invitations')).rows[0].n
  assert.equal(n,2)
 } finally {
  await a.query('rollback')
  if(pending) await pending
  await b.query('rollback')
 }
})

test('provisión concurrente de guardia es idempotente y la desactivación vence a una consulta en espera',async()=>{
 const guard=randomUUID()
 const condo=(await owner.query('select condominium_id from accesshome.residences where id=$1',[house])).rows[0].condominium_id
 await owner.query('insert into auth.users values($1)',[guard])
 let pending
 try {
  await a.query('begin'); await b.query('begin')
  await a.query('select accesshome_private.provision_guard($1,$2,$3)',[guard,condo,'Guardia concurrente'])
  pending=settled(b.query('select accesshome_private.provision_guard($1,$2,$3)',[guard,condo,'Guardia concurrente']))
  await waitBlocked(b,a)
  await a.query('commit')
  assert.equal((await pending).error,undefined)
  await b.query('commit')
  assert.equal((await owner.query('select count(*)::int as n from accesshome.profiles where user_id=$1',[guard])).rows[0].n,1)
  pending=null
  await a.query('begin')
  await a.query('select accesshome_private.set_guard_active($1,$2,false)',[guard,condo])
  await begin(b)
  await b.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:guard,is_anonymous:false})])
  pending=settled(b.query('select accesshome.guard_dashboard()'))
  await waitBlocked(b,a)
  await a.query('commit')
  assert.equal((await pending).error?.code,'42501')
 } finally {
  await a.query('rollback')
  if(pending) await pending
  await b.query('rollback')
 }
})

const scannerUsers=[randomUUID(),randomUUID()]
let scannersReady=false
async function scanFixture() {
 if(!scannersReady) {
  const condo=(await owner.query('select condominium_id from accesshome.residences where id=$1',[house])).rows[0].condominium_id
  for(const id of scannerUsers) {
   await owner.query('insert into auth.users values($1)',[id])
   await owner.query('select accesshome_private.provision_guard($1,$2,$3)',[id,condo,'Guardia de prueba'])
  }
  scannersReady=true
 }
 await begin(a)
 try {
  const id=(await create(a,{source:'occasional',visitorName:'Carrera de escaneo',phone:'',vehicle:null,saveAsContact:false,validity:{kind:'24hours'}})).rows[0].id
  const invitation=(await a.query('select accesshome.invitation_details($1) as data',[id])).rows[0].data
  await a.query('commit')
  return invitation
 } catch(error) {await a.query('rollback');throw error}
}
async function beginGuard(client,index=0,isolation='READ COMMITTED') {
 await begin(client,isolation)
 await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:scannerUsers[index],is_anonymous:false})])
}
const validate=(client,token,request=randomUUID())=>client.query('select accesshome.validate_access($1,$2,$3) as data',[token,request,'QR'])
async function scanRace({sameRequest=false,rollback=false,isolation='READ COMMITTED',exit=false,holdMs=0}={}) {
 const i=await scanFixture(),request=randomUUID()
 if(exit) {
  await beginGuard(a);await validate(a,i.token);await a.query('commit')
  await owner.query("update accesshome.access_records set occurred_at=clock_timestamp()-interval '4 seconds' where invitation_id=$1",[i.id])
 }
 let pending
 try {
  await beginGuard(a,0,isolation);await beginGuard(b,sameRequest?0:1,isolation)
  await b.query('select count(*) from accesshome.invitations')
  const first=(await validate(a,i.token,request)).rows[0].data
  pending=settled(validate(b,i.token,sameRequest?request:randomUUID()))
  await waitBlocked(b,a)
  if(holdMs) await delay(holdMs)
  await a.query(rollback?'rollback':'commit')
  const second=await pending
  await b.query(second.error?'rollback':'commit')
  const records=(await owner.query('select direction from accesshome.access_records where invitation_id=$1 order by occurred_at',[i.id])).rows
  const uses=(await owner.query('select used_uses from accesshome.invitations where id=$1',[i.id])).rows[0].used_uses
  return {first,second,records,uses}
 } finally {
  await a.query('rollback');if(pending) await pending;await b.query('rollback')
 }
}
test('escáner: dos guardias con solicitudes distintas producen una entrada y ninguna salida (5 carreras)',async()=>{
 for(let n=0;n<5;n++) {
  const {second,records,uses}=await scanRace()
  assert.equal(second.error,undefined)
  assert.equal(second.value.rows[0].data.reason,'concurrent_scan')
  assert.deepEqual(records,[{direction:'entrada'}]);assert.equal(uses,1)
 }
})
test('escáner: reintentos concurrentes del mismo request recuperan el registro sin otro uso',async()=>{
 const {first,second,records,uses}=await scanRace({sameRequest:true})
 assert.deepEqual(second.value.rows[0].data,{...first,replayed:true})
 assert.equal(records.length,1);assert.equal(uses,1)
})

test('escáner: esperar más de 3 segundos por el lock tampoco convierte el duplicado en salida',async()=>{
 const {second,records,uses}=await scanRace({holdMs:3100})
 assert.equal(second.value.rows[0].data.reason,'concurrent_scan')
 assert.deepEqual(records,[{direction:'entrada'}]);assert.equal(uses,1)
})
test('escáner: ROLLBACK libera el primer uso para el segundo guardia',async()=>{
 const {second,records,uses}=await scanRace({rollback:true})
 assert.equal(second.value.rows[0].data.authorized,true)
 assert.deepEqual(records,[{direction:'entrada'}]);assert.equal(uses,1)
})
test('escáner: dos salidas simultáneas registran solo una y completan la invitación',async()=>{
 const {second,records,uses}=await scanRace({exit:true})
 assert.equal(second.value.rows[0].data.reason,'completed')
 assert.deepEqual(records,[{direction:'entrada'},{direction:'salida'}]);assert.equal(uses,2)
})
test('escáner: snapshot antiguo en REPEATABLE READ aborta sin consumir otro movimiento',async()=>{
 const {second,records,uses}=await scanRace({isolation:'REPEATABLE READ'})
 assert.equal(second.error.code,'40001');assert.equal(records.length,1);assert.equal(uses,1)
})
test('escáner: cancelación en otra conexión vence a lectura bloqueada',async()=>{
 const i=await scanFixture()
 let pending
 try {
  await begin(a);await a.query('select accesshome.cancel_invitation($1)',[i.id])
  await beginGuard(b,1);pending=settled(validate(b,i.token))
  await waitBlocked(b,a);await a.query('commit')
  assert.equal((await pending).value.rows[0].data.reason,'cancelled')
  await b.query('commit')
  assert.equal((await owner.query('select count(*)::int as n from accesshome.access_records where invitation_id=$1',[i.id])).rows[0].n,0)
 } finally {await a.query('rollback');if(pending) await pending;await b.query('rollback')}
})

for(const scenario of ['manual/manual','manual/QR','QR/manual','replay','rollback']) {
 test('salida sin QR concurrente: '+scenario,async()=>{
  const i=await scanFixture(),request=randomUUID()
  await beginGuard(a)
  const entry=(await validate(a,i.token)).rows[0].data.record
  await a.query('commit')
  await owner.query("update accesshome.access_records set occurred_at=clock_timestamp()-interval '4 seconds' where invitation_id=$1",[i.id])
  await owner.query("update accesshome.invitations set status='cancelada' where id=$1",[i.id])
  const manual=(client,id)=>client.query('select accesshome.guard_register_exit($1,$2) as data',[entry.id,id])
  let pending
  try {
   await beginGuard(a);await beginGuard(b,scenario==='replay'?0:1)
   const first=(await (scenario==='QR/manual'?validate(a,i.token,request):manual(a,request))).rows[0].data
   assert.equal(first.authorized,true)
   pending=settled(scenario==='manual/QR'?validate(b,i.token):manual(b,scenario==='replay'?request:randomUUID()))
   await waitBlocked(b,a)
   await a.query(scenario==='rollback'?'rollback':'commit')
   const second=await pending
   assert.equal(second.error,undefined)
   await b.query('commit')
   if(scenario==='replay') assert.deepEqual(second.value.rows[0].data,{...first,replayed:true})
   else assert.equal(second.value.rows[0].data.authorized,scenario==='rollback')
   const records=(await owner.query('select direction,method,invitation_status_before from accesshome.access_records where invitation_id=$1 order by occurred_at',[i.id])).rows
   assert.equal(records.length,2); assert.equal(records[1].direction,'salida')
   assert.equal(records[1].method,scenario==='QR/manual'?'QR':'MANUAL')
   assert.equal(records[1].invitation_status_before,'cancelada')
  } finally {await a.query('rollback');if(pending) await pending;await b.query('rollback')}
 })
}
