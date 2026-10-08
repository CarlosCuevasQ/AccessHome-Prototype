import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { installSharedSchema } from './helpers/shared-sql-fixture.mjs'

const db=new PGlite({extensions:{pgcrypto}})
const users=Object.fromEntries(['admin','daniel','ana','guard','guard2','other','otherAdmin'].map(n=>[n,randomUUID()]))
let seed,closed,openExpired,openCancelled,serviceOpen,report
const period={start:'2020-01-02T07:00',end:'2020-01-02T15:00'}
const input={...period,notes:'Turno ordinario',incidents:'Un servicio rechazado'}
async function actor(user,fn,extra={}) {
 return db.transaction(async tx=>{
  await tx.exec('set local role '+(user?'authenticated':'anon'))
  await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:users[user],is_anonymous:false,...extra})])
  return fn(tx)
 })
}
const call=(user,operation,input={},request=null)=>actor(user,async tx=>(await tx.query('select accesshome.guard_reports($1,$2,$3) as data',[operation,JSON.stringify(input),request])).rows[0].data)
const rpc=(user,name,args)=>actor(user,async tx=>(await tx.query(`select accesshome.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as data`,args)).rows[0].data)
async function visit(name,exit=false) {
 const id=await rpc('daniel','create_invitation',[JSON.stringify({source:'occasional',visitorName:name,phone:'',saveAsContact:false,validity:{kind:'24hours'}})])
 const details=await rpc('daniel','invitation_details',[id])
 await rpc('admin','validate_access',[details.token,randomUUID()])
 if(exit) await rpc('admin','validate_access',[details.token,randomUUID()])
 return id
}
const service=(op,id=null)=>rpc('guard','service_command',[op,id,JSON.stringify(op==='register'?{category:'paqueteria',company:'Amazon',residenceId:seed.residence24}:{}),randomUUID()])
async function sources() {
 const result={}
 for(const table of ['invitations','access_records','service_visits','service_events']) result[table]=(await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') as rows from accesshome.${table} t`)).rows[0].rows
 return result
}
before(async()=>{
 await installSharedSchema(db)
 for(const id of Object.values(users)) await db.query('insert into auth.users values($1)',[id])
 seed=(await db.query('select accesshome_private.seed_demo($1) as data',[JSON.stringify({admin:users.admin,daniel:users.daniel,ana:users.ana})])).rows[0].data
 for(const n of ['guard','guard2']) await db.query('select accesshome_private.provision_guard($1,$2,$3)',[users[n],seed.condominiumId,'Guardia '+n])
 const other=(await db.query("insert into accesshome.condominiums(name) values('Otro condominio') returning id")).rows[0].id
 await db.query('select accesshome_private.provision_guard($1,$2,$3)',[users.other,other,'Guardia ajeno'])
 await db.query("insert into accesshome.profiles(user_id,condominium_id,display_name,role) values($1,$2,'Otro admin','admin')",[users.otherAdmin,other])
 closed=await visit('Con salida',true);openExpired=await visit('Vencida');openCancelled=await visit('Cancelada')
 await rpc('daniel','cancel_invitation',[openCancelled])
 await db.query("update accesshome.invitations set starts_at='2020-01-01T00:00:00Z',expires_at='2020-01-02T00:00:00Z' where id=$1",[openExpired])
 const completed=(await service('register')).record.id;await service('allow',completed);await service('exit',completed)
 serviceOpen=(await service('register')).record.id;await service('allow',serviceOpen)
 const rejected=(await service('register')).record.id;await service('reject',rejected)
 // Only disposable fixture data is retimed to a deterministic past period.
 await db.exec("update accesshome.access_records set occurred_at='2020-01-02T15:00:00Z'; update accesshome.service_events set occurred_at='2020-01-02T15:00:00Z'")
})
after(()=>db.close())

test('preview: registros reales, llegada ≠ entrada, pendientes vencidos/cancelados y zona SQL',async()=>{
 const before=await sources(),p=await call('guard','preview',period)
 assert.deepEqual(p.metrics,{visitorEntries:3,visitorExits:1,serviceArrivals:3,serviceEntries:2,serviceExits:1,serviceRejections:1,openVisits:2,openServices:1,visitorRejections:null})
 assert.equal(new Date(p.period_start).toISOString(),'2020-01-02T13:00:00.000Z')
 assert.equal(new Date(p.period_end).toISOString(),'2020-01-02T21:00:00.000Z')
 assert.equal(p.time_zone,'America/Mexico_City')
 assert.deepEqual(await sources(),before)
 assert.equal((await db.query('select count(*)::int as n from accesshome.guard_shift_reports')).rows[0].n,0)
 assert.equal((await call('other','preview',period)).metrics.openVisits,0)
})

test('cierre recalcula después del preview, guarda snapshot/admin igual, no cierra ni modifica fuentes',async()=>{
 const preview=await call('guard','preview',period)
 const newArrival=(await service('register')).record.id
 await db.query("update accesshome.service_events set occurred_at='2020-01-02T16:00:00Z' where service_id=$1",[newArrival])
 const before=await sources(),request=randomUUID()
 const result=await call('guard','generate',input,request);report=result.report
 assert.equal(result.replayed,false);assert.equal(report.status,'finalizado');assert.equal(report.guard_user_id,users.guard)
 assert.equal(report.condominium_id,seed.condominiumId)
 assert.equal(report.metrics.serviceArrivals,preview.metrics.serviceArrivals+1)
 assert.equal(report.metrics.serviceEntries,2);assert.equal(report.metrics.openServices,1)
 assert.deepEqual(await sources(),before)
 assert.deepEqual(await call('admin','detail',{id:report.id}),report)
 assert.deepEqual(await call('guard','detail',{id:report.id}),report)
 assert.deepEqual(await call('guard','generate',input,request),{report,replayed:true})
 await assert.rejects(call('guard','generate',{...input,notes:'cambio'},request),/operación no disponible/)
 await assert.rejects(call('guard2','generate',input,request),/operación no disponible/)
 await assert.rejects(call('guard','generate',input,randomUUID()),/Ya cerraste/)
 const stored=(await db.query('select source_ids from accesshome.guard_shift_reports where id=$1',[report.id])).rows[0].source_ids
 assert.equal(stored.openVisits.length,2);assert.equal(stored.serviceArrivals.length,4)
 assert.equal('source_ids' in report,false);assert.equal('request_id' in report,false)
 await service('exit',serviceOpen)
 assert.deepEqual(await call('admin','detail',{id:report.id}),report)
 assert.equal((await call('guard','preview',period)).metrics.openServices,0)
})

test('no permite totales, guardia, condominio, generated_at ni claves inesperadas',async()=>{
 for(const [key,value] of Object.entries({visitorEntries:25,guard_user_id:users.other,condominium_id:randomUUID(),generated_at:'2000-01-01',metrics:{visitorEntries:500},status:'borrador'})) {
  await assert.rejects(call('guard','generate',{...input,[key]:value},randomUUID()),/Campos/)
  await assert.rejects(call('guard','preview',{...period,[key]:value}),/Campos/)
 }
 for(const operation of ['update','delete','edit']) await assert.rejects(call('guard',operation,{}),/Operación/)
})

test('tabla de cierres sin SELECT de tabla/columnas; guardia/admin conservan list/detail por RPC',async()=>{
 const permissions=(await db.query(`select
   has_table_privilege('authenticated','accesshome.guard_shift_reports','SELECT') as table_select,
   has_any_column_privilege('authenticated','accesshome.guard_shift_reports','SELECT') as column_select,
   (select relrowsecurity from pg_class where oid='accesshome.guard_shift_reports'::regclass) as rls`)).rows[0]
 assert.deepEqual(permissions,{table_select:false,column_select:false,rls:true})
 for(const who of ['guard','admin']) {
  // These actors would satisfy the retained RLS policy for this very row.
  for(const columns of ['*','id','source_ids','request_id','command_input']) {
   await assert.rejects(actor(who,tx=>tx.query(`select ${columns} from accesshome.guard_shift_reports where id=$1`,[report.id])),error=>error.code==='42501')
  }
  const detail=await call(who,'detail',{id:report.id})
  const listed=(await call(who,'list')).records.find(row=>row.id===report.id)
  assert.deepEqual(detail,report);assert.deepEqual(listed,report)
  for(const data of [detail,listed]) for(const column of ['source_ids','request_id','command_input']) assert.equal(Object.hasOwn(data,column),false)
 }
})

test('RLS/permisos: guardia propio, admin condominio, ajenos/residente/anon/inactivo rechazados',async()=>{
 for(const who of ['other','otherAdmin','guard2']) {
  await assert.rejects(call(who,'detail',{id:report.id}),/no disponible/)
  assert.equal((await call(who,'list')).records.length,0)
  await assert.rejects(actor(who,tx=>tx.query('select count(*) from accesshome.guard_shift_reports')),error=>error.code==='42501')
 }
 for(const who of ['daniel',null]) {
  for(const op of ['context','list','detail','preview','generate']) await assert.rejects(call(who,op,op==='detail'?{id:report.id}:op==='preview'?period:op==='generate'?input:{},randomUUID()))
 }
 await assert.rejects(call('admin','generate',input,randomUUID()),/Solo guardias/)
 await assert.rejects(call('admin','preview',period),/Solo guardias/)
 await db.query('select accesshome_private.set_guard_active($1,$2,false)',[users.guard,seed.condominiumId])
 try {for(const op of ['list','preview','generate']) await assert.rejects(call('guard',op,op==='list'?{}:input,randomUUID()))}
 finally {await db.query('select accesshome_private.set_guard_active($1,$2,true)',[users.guard,seed.condominiumId])}
 await assert.rejects(actor('daniel',tx=>tx.query("select accesshome.guard_reports('generate',$1,$2)",[JSON.stringify(input),randomUUID()]),{user_metadata:{role:'guard',condominium_id:seed.condominiumId}}))
 await assert.rejects(actor('daniel',tx=>tx.query("select accesshome_private.guard_reports('generate',$1,$2)",[JSON.stringify(input),randomUUID()])))
 for(const who of ['guard','admin']) for(const sql of ["update accesshome.guard_shift_reports set metrics='{}'","delete from accesshome.guard_shift_reports","insert into accesshome.guard_shift_reports(id) values(gen_random_uuid())"]) await assert.rejects(actor(who,tx=>tx.exec(sql)),/permission denied/)
 for(const sql of ["select accesshome_private.shift_snapshot($1,now(),now())","select accesshome_private.shift_instant('2020-01-01T00:00','UTC')"]) await assert.rejects(actor('guard',tx=>tx.query(sql,sql.includes('$1')?[seed.condominiumId]:[])),/permission denied/)
})

test('periodos: servidor rechaza futuros, orden incorrecto, >7 días y texto/HTML excesivo',async()=>{
 for(const p of [{start:period.end,end:period.start},{start:period.start,end:period.start},{start:'2100-01-01T00:00',end:'2100-01-01T08:00'},{start:'2020-01-01T00:00',end:'2020-01-09T00:00'},{start:'invalid',end:period.end},{start:period.start+'Z',end:period.end}]) await assert.rejects(call('guard','preview',p))
 for(const text of ['x'.repeat(2001),'<script>alert(1)</script>']) await assert.rejects(call('guard','generate',{...input,start:'2020-01-02T06:00',notes:text},randomUUID()),/texto simple/)
 await assert.rejects(call('guard','generate',input),/identificador/)
 const context=await call('guard','context')
 assert.match(context.end,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
 assert.ok((await call('guard','preview',{start:context.start,end:context.end})).generated_at)
})

test('fronteras [inicio,fin), filtros fecha local y guardia; distintos turnos/autores legítimos',async()=>{
 const id=(await service('register')).record.id
 await db.query("update accesshome.service_events set occurred_at='2020-01-03T06:00:00Z' where service_id=$1",[id])
 const p={start:'2020-01-03T00:00',end:'2020-01-03T01:00'}
 assert.equal((await call('guard','preview',p)).metrics.serviceArrivals,1)
 assert.equal((await call('guard','preview',{start:'2020-01-02T23:00',end:p.start})).metrics.serviceArrivals,0)
 const next=(await call('guard','generate',{...p,notes:'',incidents:''},randomUUID())).report
 const other=(await call('guard2','generate',input,randomUUID())).report
 const list=await call('admin','list',{from:'2020-01-03',to:'2020-01-03'})
 assert.deepEqual(list.records.map(r=>r.id),[next.id])
 assert.deepEqual((await call('admin','list',{guard:users.guard2})).records.map(r=>r.id),[other.id])
 assert.equal((await call('guard','list',{guard:users.guard2})).records.length,0)
 assert.equal((await call('admin','context')).guards.length,2)
 await assert.rejects(call('admin','list',{page:-1}))
 await assert.rejects(call('admin','list',{from:'2020-01-04',to:'2020-01-03'}))
})

test('zona horaria SQL: DST inexistente rechazada y repetida usa interpretación estándar documentada',async()=>{
 await assert.rejects(db.query("select accesshome_private.shift_instant('2020-03-08T02:30','America/New_York')"),/inexistente/)
 const r=(await db.query("select accesshome_private.shift_instant('2020-11-01T01:30','America/New_York') as instant")).rows[0]
 assert.equal(new Date(r.instant).toISOString(),'2020-11-01T06:30:00.000Z')
})

test('health y snapshot no exponen tokens/datos privados ni cuentan rechazos QR inventados',async()=>{
 const health=await rpc(null,'backend_health',[])
 assert.equal(health.schemaVersion,9);assert.equal(health.guardReportsVersion,1);assert.equal(health.serviceAccessVersion,1)
 assert.equal(report.metrics.visitorRejections,null)
 const text=JSON.stringify(report)
 for(const name of ['visitor_name','phone','token_value','vehicle_plates','request_id','command_input']) assert.equal(text.includes(name),false)
})
