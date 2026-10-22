import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { installSharedSchema } from './helpers/shared-sql-fixture.mjs'

// Regresión: una visita con entrada abierta debe poder salir aunque el admin
// desactive la casa después; la casa inactiva sigue sin admitir entradas.
const db=new PGlite({extensions:{pgcrypto}})
const users=Object.fromEntries(['admin','daniel','ana','guard','other'].map(name=>[name,randomUUID()]))
let seed, house
async function actor(name,fn) {
  return db.transaction(async tx=>{
    await tx.exec('set local role authenticated')
    await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:users[name],is_anonymous:false})])
    return fn(tx)
  })
}
const call=(name,sql,args=[])=>actor(name,async tx=>(await tx.query(sql,args)).rows[0].data)
const scan=(token,user='guard',request=randomUUID(),method='QR')=>call(user,'select accesshome.validate_access($1,$2,$3) as data',[token,request,method])
const manualExit=(entryId,user='guard',request=randomUUID())=>call(user,'select accesshome.guard_register_exit($1,$2) as data',[entryId,request])
const openVisits=()=>call('guard','select accesshome.guard_open_visits(0) as data')
const rows=async id=>(await db.query('select * from accesshome.access_records where invitation_id=$1 order by occurred_at',[id])).rows
const ageEntry=id=>db.query("update accesshome.access_records set occurred_at=clock_timestamp()-interval '4 seconds' where invitation_id=$1",[id])
async function invite() {
  const id=await call('daniel','select accesshome.create_invitation($1::jsonb) as data',[JSON.stringify({source:'occasional',visitorName:'Visita casa desactivada',phone:'',vehicle:null,saveAsContact:false,validity:{kind:'24hours'}})])
  return call('daniel','select accesshome.invitation_details($1) as data',[id])
}
// La desactivación usa el RPC administrativo real, no SQL del propietario.
const setHouseActive=active=>call('admin','select accesshome.manage_community($1,$2,$3::jsonb) as data',
  ['update_residence',seed.residence24,JSON.stringify({number:String(house.number),street:house.street,active})])

before(async()=>{
  await installSharedSchema(db)
  for(const id of Object.values(users)) await db.query('insert into auth.users values($1)',[id])
  seed=(await db.query('select accesshome_private.seed_demo($1) as data',[JSON.stringify({admin:users.admin,daniel:users.daniel,ana:users.ana})])).rows[0].data
  await db.query('select accesshome_private.provision_guard($1,$2,$3)',[users.guard,seed.condominiumId,'Guardia caseta'])
  const other=(await db.query("insert into accesshome.condominiums(name) values('Otro condominio') returning id")).rows[0].id
  await db.query('select accesshome_private.provision_guard($1,$2,$3)',[users.other,other,'Guardia ajeno'])
  house=(await db.query('select number,street from accesshome.residences where id=$1',[seed.residence24])).rows[0]
})
after(()=>db.close())

for(const mechanism of ['QR','salida manual']) {
  test('casa desactivada con visita abierta: '+mechanism+' registra la salida con trazabilidad',async()=>{
    const i=await invite(), entry=await scan(i.token)
    assert.equal(entry.authorized,true); assert.equal(entry.record.type,'entrada')
    await ageEntry(i.id)
    await setHouseActive(false)
    try {
      assert.ok((await openVisits()).records.some(r=>r.id===entry.record.id),'la visita debe seguir pendiente en caseta')
      const result=mechanism==='QR'?await scan(i.token):await manualExit(entry.record.id)
      assert.equal(result.authorized,true,'salida bloqueada: '+JSON.stringify({reason:result.reason,message:result.message}))
      assert.equal(result.record.type,'salida')
      assert.equal(result.record.method,mechanism==='QR'?'QR':'MANUAL')
      const stored=await rows(i.id)
      assert.deepEqual(stored.map(r=>r.direction),['entrada','salida'])
      assert.equal(stored[1].validated_by,users.guard)
      assert.equal((await db.query('select status from accesshome.invitations where id=$1',[i.id])).rows[0].status,'completada')
      assert.equal((await openVisits()).records.some(r=>r.id===entry.record.id),false)
    } finally { await setHouseActive(true) }
  })
}

test('casa desactivada con visita abierta e invitación vencida: el guardia registra solo la salida',async()=>{
  const i=await invite(), entry=await scan(i.token)
  await ageEntry(i.id)
  await db.query("update accesshome.invitations set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",[i.id])
  await setHouseActive(false)
  try {
    const result=await manualExit(entry.record.id)
    assert.equal(result.authorized,true,'salida bloqueada: '+JSON.stringify({reason:result.reason,message:result.message}))
    assert.equal(result.record.type,'salida')
    assert.equal(result.record.invitationEffectiveStatusBefore,'expirada')
  } finally { await setHouseActive(true) }
})

test('casa desactivada sigue sin admitir entradas por QR ni por token manual',async()=>{
  const i=await invite()
  await setHouseActive(false)
  try {
    for(const method of ['QR','MANUAL']) assert.equal((await scan(i.token,'guard',randomUUID(),method)).reason,'inactive_residence')
    assert.equal((await rows(i.id)).length,0)
    assert.equal((await db.query('select used_uses from accesshome.invitations where id=$1',[i.id])).rows[0].used_uses,0)
  } finally { await setHouseActive(true) }
})

test('casa desactivada: guardia ajeno, residente y admin no pueden cerrar la visita abierta',async()=>{
  const i=await invite(), entry=await scan(i.token)
  await ageEntry(i.id)
  await setHouseActive(false)
  try {
    assert.equal((await scan(i.token,'other')).reason,'not_found')
    assert.equal((await manualExit(entry.record.id,'other')).reason,'not_found')
    for(const user of ['daniel','admin']) await assert.rejects(manualExit(entry.record.id,user),/guardia activo/)
    assert.deepEqual((await rows(i.id)).map(r=>r.direction),['entrada'])
  } finally { await setHouseActive(true) }
})

// La excepción para casa inactiva nunca produce otra entrada ni reutiliza la invitación.
const duplicateEntrySql="insert into accesshome.access_records(invitation_id,condominium_id,residence_id,inviter_user_id,validated_by,request_id,visitor_name,residence_name,inviter_name,direction,method) select invitation_id,condominium_id,residence_id,inviter_user_id,validated_by,gen_random_uuid(),visitor_name,residence_name,inviter_name,'entrada','MANUAL' from accesshome.access_records where id=$1"

test('casa inactiva con entrada registrada: no existe vía para solicitar otra entrada',async()=>{
  const i=await invite(), entry=await scan(i.token)
  await ageEntry(i.id)
  await setHouseActive(false)
  try {
    // El RPC no recibe dirección: la decide SQL. Un cuarto argumento no existe y un método distinto se rechaza.
    await assert.rejects(call('guard','select accesshome.validate_access($1,$2,$3,$4) as data',[i.token,randomUUID(),'QR','entrada']),/does not exist/)
    await assert.rejects(scan(i.token,'guard',randomUUID(),'ENTRADA'),/método/)
    // La excepción no se amplía al admin.
    assert.equal((await scan(i.token,'admin')).reason,'inactive_residence')
    // Escritura directa de una entrada: sin privilegio.
    await assert.rejects(actor('guard',tx=>tx.query(duplicateEntrySql,[entry.record.id])),/permission denied/)
    // Invariante de la base: ni el propietario puede insertar una segunda entrada.
    await assert.rejects(db.query(duplicateEntrySql,[entry.record.id]),/duplicate key|unique/)
    assert.deepEqual((await rows(i.id)).map(r=>r.direction),['entrada'])
    // Segunda lectura del guardia = salida (decidida por used_uses=1 bajo bloqueo), nunca entrada.
    const exit=await scan(i.token)
    assert.equal(exit.authorized,true); assert.equal(exit.record.type,'salida')
    await ageEntry(i.id)
    // Tras completar: ni QR ni token manual ni salida manual vuelven a usar la invitación.
    assert.equal((await scan(i.token)).reason,'completed')
    assert.equal((await scan(i.token,'guard',randomUUID(),'MANUAL')).reason,'completed')
    assert.equal((await manualExit(entry.record.id)).reason,'invalid_sequence')
    assert.deepEqual((await rows(i.id)).map(r=>r.direction),['entrada','salida'])
    const inv=(await db.query('select used_uses,status from accesshome.invitations where id=$1',[i.id])).rows[0]
    assert.deepEqual(inv,{used_uses:2,status:'completada'})
  } finally { await setHouseActive(true) }
})

test('casa inactiva: entries/exits salen del historial, no del contador; anomalías no producen movimientos',async()=>{
  // Contador alterado sin entrada real: entries=0, la excepción no aplica.
  const a=await invite()
  await db.query('update accesshome.invitations set used_uses=1 where id=$1',[a.id])
  await setHouseActive(false)
  try {
    assert.equal((await scan(a.token)).reason,'invalid_sequence')
    assert.equal((await rows(a.id)).length,0)
  } finally { await setHouseActive(true) }
  // Entrada real con contador reiniciado: entries=1 pero used_uses=0. Sin el control de secuencia sería una segunda entrada.
  const b=await invite(); await scan(b.token); await ageEntry(b.id)
  await db.query('update accesshome.invitations set used_uses=0 where id=$1',[b.id])
  await setHouseActive(false)
  try {
    assert.equal((await scan(b.token)).reason,'invalid_sequence')
    assert.equal((await scan(b.token,'guard',randomUUID(),'MANUAL')).reason,'invalid_sequence')
    assert.deepEqual((await rows(b.id)).map(r=>r.direction),['entrada'])
  } finally { await setHouseActive(true) }
  // Visita ya completada con contador reabierto: exits=1, la excepción tampoco aplica.
  const c=await invite(); await scan(c.token); await ageEntry(c.id); await scan(c.token); await ageEntry(c.id)
  await db.query("update accesshome.invitations set used_uses=1,status='activa' where id=$1",[c.id])
  await setHouseActive(false)
  try {
    assert.equal((await scan(c.token)).reason,'invalid_sequence')
    assert.deepEqual((await rows(c.id)).map(r=>r.direction),['entrada','salida'])
  } finally { await setHouseActive(true) }
})

test('casa inactiva: reintento con el mismo request_id recupera la misma salida sin duplicarla',async()=>{
  const i=await invite(); await scan(i.token); await ageEntry(i.id)
  const j=await invite(), entryJ=await scan(j.token); await ageEntry(j.id)
  await setHouseActive(false)
  try {
    const request=randomUUID(), first=await scan(i.token,'guard',request)
    assert.equal(first.record.type,'salida')
    assert.deepEqual(await scan(i.token,'guard',request),{...first,replayed:true})
    await assert.rejects(scan(i.token,'guard',request,'MANUAL'),/operación no disponible/)
    const manualRequest=randomUUID(), m=await manualExit(entryJ.record.id,'guard',manualRequest)
    assert.equal(m.record.type,'salida'); assert.equal(m.record.method,'MANUAL')
    assert.deepEqual(await manualExit(entryJ.record.id,'guard',manualRequest),{...m,replayed:true})
    assert.equal((await rows(i.id)).length,2); assert.equal((await rows(j.id)).length,2)
  } finally { await setHouseActive(true) }
})

test('casa inactiva, invitación cancelada y visita abierta: solo salida',async()=>{
  const i=await invite(); await scan(i.token); await ageEntry(i.id)
  await call('daniel','select accesshome.cancel_invitation($1) as data',[i.id])
  await setHouseActive(false)
  try {
    const result=await scan(i.token)
    assert.equal(result.record.type,'salida'); assert.equal(result.record.invitationEffectiveStatusBefore,'cancelada')
    assert.deepEqual((await rows(i.id)).map(r=>r.direction),['entrada','salida'])
  } finally { await setHouseActive(true) }
})
