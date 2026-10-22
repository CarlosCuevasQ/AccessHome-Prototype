import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { installSharedSchema } from './helpers/shared-sql-fixture.mjs'
import { invitationQrPurpose } from '../.test-build/services/invitationQrPurpose.js'

// La vista pública debe reflejar, calculado en SQL, que una casa inactiva no admite
// entradas; caseta sigue siendo la autoridad. Casa 24 con guardia del condominio y
// un guardia de otro condominio para el aislamiento.
const db = new PGlite({ extensions: { pgcrypto } })
const users = Object.fromEntries(['admin','daniel','ana','guard','other'].map(name => [name, randomUUID()]))
let seed, house
const keys = ['token','visitorName','residenceName','condominiumName','startsAt','expiresAt','status','hasOpenEntry','residenceActive'].sort()
async function actor(name, fn) {
  return db.transaction(async tx => {
    await tx.exec('set local role ' + (name ? 'authenticated' : 'anon'))
    await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: name ? users[name] : null, is_anonymous: false })])
    return fn(tx)
  })
}
const call = (name, sql, args = []) => actor(name, async tx => (await tx.query(sql, args)).rows[0].data)
const publicView = token => call(null, 'select accesshome.public_invitation($1,null) as data', [token])
const scan = (token, user = 'guard') => call(user, 'select accesshome.validate_access($1,$2,$3) as data', [token, randomUUID(), 'QR'])
const rows = async id => (await db.query('select direction from accesshome.access_records where invitation_id=$1 order by occurred_at', [id])).rows.map(r => r.direction)
const age = id => db.query("update accesshome.access_records set occurred_at=clock_timestamp()-interval '4 seconds' where invitation_id=$1", [id])
async function invite(name = 'Visita pública') {
  const id = await call('daniel', 'select accesshome.create_invitation($1::jsonb) as data', [JSON.stringify({ source: 'occasional', visitorName: name, phone: 'privado-55', vehicle: null, saveAsContact: false, validity: { kind: '24hours' } })])
  return call('daniel', 'select accesshome.invitation_details($1) as data', [id])
}
async function setHouse(active) {
  await call('admin', 'select accesshome.manage_community($1,$2,$3::jsonb) as data', ['update_residence', house.id, JSON.stringify({ number: String(house.number), street: house.street, active })])
}
const purpose = view => invitationQrPurpose(view.status, view.hasOpenEntry, view.residenceActive)

before(async () => {
  await installSharedSchema(db)
  for (const id of Object.values(users)) await db.query('insert into auth.users values($1)', [id])
  seed = (await db.query('select accesshome_private.seed_demo($1::jsonb) as s', [JSON.stringify({ admin: users.admin, daniel: users.daniel, ana: users.ana })])).rows[0].s
  house = (await db.query('select id,number,street from accesshome.residences where id=$1', [seed.residence24])).rows[0]
  await db.query('select accesshome_private.provision_guard($1,$2,$3)', [users.guard, seed.condominiumId, 'Guardia'])
  const other = (await db.query("insert into accesshome.condominiums(name) values('Otro condominio') returning id")).rows[0].id
  await db.query('select accesshome_private.provision_guard($1,$2,$3)', [users.other, other, 'Guardia ajeno'])
})
after(() => db.close())

test('casa activa: invitación válida conserva estado, QR de acceso y entrada normal', async () => {
  await setHouse(true)
  const i = await invite()
  const view = await publicView(i.token)
  assert.deepEqual(Object.keys(view).sort(), keys)
  assert.equal(view.status, 'activa'); assert.equal(view.residenceActive, true); assert.equal(view.hasOpenEntry, false)
  assert.equal(purpose(view), 'access')
  const entry = await scan(i.token)
  assert.equal(entry.authorized, true); assert.equal(entry.record.type, 'entrada')
  const inside = await publicView(i.token)
  assert.equal(inside.hasOpenEntry, true); assert.equal(purpose(inside), 'access')
})

test('casa inactiva sin entrada: SQL indica no disponible, sin QR de acceso y caseta rechaza la entrada', async () => {
  const i = await invite('Casa inactiva')
  await setHouse(false)
  try {
    const view = await publicView(i.token)
    assert.deepEqual(Object.keys(view).sort(), keys)
    // El estado de la invitación no se reescribe; la disponibilidad de la casa viaja aparte.
    assert.equal(view.status, 'activa'); assert.equal(view.residenceActive, false); assert.equal(view.hasOpenEntry, false)
    assert.equal(purpose(view), 'inactive_residence')
    assert.equal(JSON.stringify(view).includes('privado-55'), false)
    assert.equal((await scan(i.token)).reason, 'inactive_residence')
    assert.deepEqual(await rows(i.id), [])
    // Aislamiento: un guardia de otro condominio sigue sin encontrarla.
    assert.equal((await scan(i.token, 'other')).reason, 'not_found')
  } finally { await setHouse(true) }
  const reactivated = await publicView(i.token)
  assert.equal(reactivated.residenceActive, true); assert.equal(purpose(reactivated), 'access')
  assert.equal((await scan(i.token)).record.type, 'entrada')
})

test('casa inactiva con visita abierta: QR solo de salida y el guardia la cierra', async () => {
  const i = await invite('Visita dentro')
  await scan(i.token); await age(i.id)
  await setHouse(false)
  try {
    const view = await publicView(i.token)
    assert.equal(view.residenceActive, false); assert.equal(view.hasOpenEntry, true)
    assert.equal(purpose(view), 'exit')
    const exit = await scan(i.token)
    assert.equal(exit.authorized, true); assert.equal(exit.record.type, 'salida')
    const done = await publicView(i.token)
    assert.equal(done.status, 'completada'); assert.equal(purpose(done), 'unavailable')
  } finally { await setHouse(true) }
})

test('vencida y cancelada conservan su estado; la casa inactiva no las vuelve válidas', async () => {
  const expired = await invite('Vencida')
  await db.query("update accesshome.invitations set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1", [expired.id])
  const cancelled = await invite('Cancelada')
  await call('daniel', 'select accesshome.cancel_invitation($1) as data', [cancelled.id])
  for (const active of [true, false]) {
    await setHouse(active)
    try {
      for (const [i, status] of [[expired, 'expirada'], [cancelled, 'cancelada']]) {
        const view = await publicView(i.token)
        assert.equal(view.status, status); assert.equal(view.residenceActive, active); assert.equal(view.hasOpenEntry, false)
        assert.equal(purpose(view), 'unavailable')
        assert.equal((await scan(i.token)).authorized, false)
      }
    } finally { await setHouse(true) }
  }
  assert.deepEqual(await rows(expired.id), []); assert.deepEqual(await rows(cancelled.id), [])
})

test('token inválido o inexistente conserva la respuesta segura', async () => {
  await setHouse(false)
  try {
    for (const token of ['', 'no-es-un-token', 'a'.repeat(64)]) assert.equal(await publicView(token), null)
  } finally { await setHouse(true) }
})

test('presentación: el nuevo indicador solo restringe; sin él se conserva el comportamiento previo', () => {
  assert.equal(invitationQrPurpose('activa', false, true), 'access')
  assert.equal(invitationQrPurpose('activa', false, false), 'inactive_residence')
  assert.equal(invitationQrPurpose('activa', true, false), 'exit')
  for (const status of ['expirada', 'cancelada']) {
    assert.equal(invitationQrPurpose(status, true, false), 'exit')
    assert.equal(invitationQrPurpose(status, false, false), 'unavailable')
  }
  assert.equal(invitationQrPurpose('completada', true, false), 'unavailable')
  // Sin indicador (backend anterior o detalle del residente): mismo resultado que antes.
  assert.equal(invitationQrPurpose('activa'), 'access')
  assert.equal(invitationQrPurpose('cancelada', true), 'exit')
  assert.equal(invitationQrPurpose('activa', false, 'false'), 'access')
})
