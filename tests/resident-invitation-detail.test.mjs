import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { installSharedSchema } from './helpers/shared-sql-fixture.mjs'
import { invitationQrPurpose } from '../.test-build/services/invitationQrPurpose.js'
import { accessTokenFromCode } from '../.test-build/services/guardScanSession.js'
import { invitationUrl } from '../.test-build/utils/invitationLinks.js'

// /residente/invitaciones/:id combina invitation_details con residence_details de la
// casa de la invitación (estado autoritativo) y decide el QR con invitationQrPurpose.
// Esta suite reproduce esa composición con las RPC reales de cada residente.
const db = new PGlite({ extensions: { pgcrypto } })
const users = Object.fromEntries(['admin','daniel','ana','mariana','guard','other'].map(name => [name, randomUUID()]))
let seed, house
async function actor(name, fn) {
  return db.transaction(async tx => {
    await tx.exec('set local role ' + (name ? 'authenticated' : 'anon'))
    await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: name ? users[name] : null, is_anonymous: false })])
    return fn(tx)
  })
}
const call = (name, sql, args = []) => actor(name, async tx => (await tx.query(sql, args)).rows[0].data)
const scan = (token, user = 'guard') => call(user, 'select accesshome.validate_access($1,$2,$3) as data', [token, randomUUID(), 'QR'])
const age = id => db.query("update accesshome.access_records set occurred_at=clock_timestamp()-interval '4 seconds' where invitation_id=$1", [id])
async function invite(name) {
  const id = await call('daniel', 'select accesshome.create_invitation($1::jsonb) as data', [JSON.stringify({ source: 'occasional', visitorName: name, phone: '', vehicle: null, saveAsContact: false, validity: { kind: '24hours' } })])
  return call('daniel', 'select accesshome.invitation_details($1) as data', [id])
}
async function setHouse(active) {
  await call('admin', 'select accesshome.manage_community($1,$2,$3::jsonb) as data', ['update_residence', house.id, JSON.stringify({ number: String(house.number), street: house.street, active })])
}
// Same two reads and decision as InvitationPage.
async function residentDetail(who, invitationId) {
  const invitation = await call(who, 'select accesshome.invitation_details($1) as data', [invitationId])
  const residence = await call(who, 'select accesshome.residence_details($1) as data', [invitation.residenceId])
  return { invitation, residenceActive: residence.residence.active, purpose: invitationQrPurpose(invitation.status, false, residence.residence.active) }
}

before(async () => {
  await installSharedSchema(db)
  for (const id of Object.values(users)) await db.query('insert into auth.users values($1)', [id])
  seed = (await db.query('select accesshome_private.seed_demo($1::jsonb) as s', [JSON.stringify({ admin: users.admin, daniel: users.daniel, ana: users.ana, mariana: users.mariana })])).rows[0].s
  house = (await db.query('select id,number,street from accesshome.residences where id=$1', [seed.residence24])).rows[0]
  await db.query('select accesshome_private.provision_guard($1,$2,$3)', [users.guard, seed.condominiumId, 'Guardia'])
  const other = (await db.query("insert into accesshome.condominiums(name) values('Otro condominio') returning id")).rows[0].id
  await db.query('select accesshome_private.provision_guard($1,$2,$3)', [users.other, other, 'Guardia ajeno'])
})
after(() => db.close())

test('el QR del detalle codifica el enlace público que caseta acepta como código de entrada', async () => {
  await setHouse(true)
  const i = await invite('Contenido del QR')
  const url = invitationUrl(i.token, 'https://accesshome.example')
  assert.equal(url, 'https://accesshome.example/invitacion/' + i.token)
  assert.equal(accessTokenFromCode(url), i.token)
  assert.equal((await scan(accessTokenFromCode(url))).record.type, 'entrada')
})

test('casa activa: principal y habitante con cuenta ven el QR de acceso como antes', async () => {
  await setHouse(true)
  const i = await invite('Casa activa')
  for (const who of ['daniel', 'mariana']) {
    const detail = await residentDetail(who, i.id)
    assert.equal(detail.invitation.status, 'activa'); assert.equal(detail.residenceActive, true)
    assert.equal(detail.purpose, 'access')
  }
})

test('casa inactiva: el detalle no comunica entrada disponible y coincide con la vista pública y caseta', async () => {
  const i = await invite('Casa inactiva')
  await setHouse(false)
  try {
    for (const who of ['daniel', 'mariana']) {
      const detail = await residentDetail(who, i.id)
      // La invitación sigue consultable con su estado; la casa inactiva viene del backend.
      assert.equal(detail.invitation.status, 'activa'); assert.equal(detail.residenceActive, false)
      assert.equal(detail.purpose, 'inactive_residence')
      assert.match(detail.invitation.token, /^[a-f0-9]{64}$/)
    }
    const view = await call(null, 'select accesshome.public_invitation($1,null) as data', [i.token])
    assert.equal(invitationQrPurpose(view.status, view.hasOpenEntry, view.residenceActive), 'inactive_residence')
    assert.equal((await scan(i.token)).reason, 'inactive_residence')
    assert.equal((await scan(i.token, 'other')).reason, 'not_found')
  } finally { await setHouse(true) }
  assert.equal((await residentDetail('daniel', i.id)).purpose, 'access')
})

test('vencida y cancelada conservan su estado en el detalle con la casa activa o inactiva', async () => {
  const expired = await invite('Vencida')
  await db.query("update accesshome.invitations set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1", [expired.id])
  const cancelled = await invite('Cancelada')
  await call('daniel', 'select accesshome.cancel_invitation($1) as data', [cancelled.id])
  for (const active of [true, false]) {
    await setHouse(active)
    try {
      for (const [i, status] of [[expired, 'expirada'], [cancelled, 'cancelada']]) {
        const detail = await residentDetail('daniel', i.id)
        assert.equal(detail.invitation.status, status); assert.equal(detail.residenceActive, active)
        assert.equal(detail.purpose, 'unavailable')
      }
    } finally { await setHouse(true) }
  }
})

test('casa inactiva: residentes consultan, sin escritura adicional; visita abierta sigue cerrándose en caseta', async () => {
  const pending = await invite('Pendiente')
  const inside = await invite('Dentro')
  await scan(inside.token); await age(inside.id)
  await setHouse(false)
  try {
    for (const who of ['daniel', 'mariana']) {
      assert.ok((await call(who, 'select accesshome.list_invitations($1,$2) as data', ['', 'todas'])).some(i => i.id === pending.id))
      assert.equal((await call(who, 'select accesshome.invitation_context() as data')).canManage, false)
      await assert.rejects(call(who, 'select accesshome.cancel_invitation($1) as data', [pending.id]), /principal de una residencia activa/)
      await assert.rejects(call(who, 'select accesshome.create_invitation($1::jsonb) as data', [JSON.stringify({ source: 'occasional', visitorName: 'Nueva', phone: '', vehicle: null, saveAsContact: false, validity: { kind: '24hours' } })]), /principal de una residencia activa/)
    }
    assert.equal((await call('daniel', 'select accesshome.invitation_details($1) as data', [pending.id])).status, 'activa')
    assert.equal((await scan(pending.token)).reason, 'inactive_residence')
    const exit = await scan(inside.token)
    assert.equal(exit.authorized, true); assert.equal(exit.record.type, 'salida')
  } finally { await setHouse(true) }
})

test('aislamiento: el detalle no lee invitaciones ni residencias de otra casa', async () => {
  const anaInvitation = await call('ana', 'select accesshome.create_invitation($1::jsonb) as data', [JSON.stringify({ source: 'occasional', visitorName: 'Casa 12', phone: '', vehicle: null, saveAsContact: false, validity: { kind: '24hours' } })])
  const house12 = (await db.query('select id from accesshome.residences where condominium_id=$1 and number=12', [seed.condominiumId])).rows[0].id
  await setHouse(false)
  try {
    for (const who of ['daniel', 'mariana']) {
      await assert.rejects(call(who, 'select accesshome.invitation_details($1) as data', [anaInvitation]), /Invitación no disponible/)
      await assert.rejects(call(who, 'select accesshome.residence_details($1) as data', [house12]), /Residencia no disponible/)
    }
  } finally { await setHouse(true) }
})
