import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { authService } from '../.test-build/services/authService.js'
import { invitationsService as invitations } from '../.test-build/services/invitationsService.js'
import { accessService as access } from '../.test-build/services/accessService.js'
import { communityService } from '../.test-build/services/communityService.js'
import { demoService } from '../.test-build/services/demoService.js'
import { createDemoData, DEMO_PASSWORD } from '../.test-build/data/demo.js'
import { DEMO_STORAGE_KEY } from '../.test-build/services/demoStorage.js'

let storage
const login = (email) => authService.login({ email, password: DEMO_PASSWORD })
const read = () => JSON.parse(storage.get(DEMO_STORAGE_KEY))
const write = (data) => storage.set(DEMO_STORAGE_KEY, JSON.stringify(data))
const input = { source: 'occasional', visitorName: 'Visita QR', phone: '', vehicle: { plates: 'QR-9001', brand: '', model: '', color: '' }, saveAsContact: false, validity: { kind: '24hours' } }
async function createInvitation(overrides = {}) {
  await login('residente@accesshome.demo')
  return invitations.getInvitation(await invitations.createInvitation({ ...input, ...overrides }))
}

beforeEach(() => {
  storage = new Map()
  globalThis.window = new EventTarget()
  window.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
})

test('entrada, salida, completada y tercer intento rechazado con exactamente dos registros QR', async () => {
  const invitation = await createInvitation()
  await login('admin@accesshome.demo')
  const entered = await access.validateToken(` ${invitation.token} `)
  assert.equal(entered.authorized, true)
  assert.equal(entered.record.type, 'entrada')
  assert.equal(entered.usedUses, 1)
  assert.equal(entered.status, 'activa')
  assert.deepEqual(entered.record, {
    id: entered.record.id, invitationId: invitation.id, visitorName: invitation.visitorName,
    residenceId: 'house-24', residenceName: 'Casa 24', inviterUserId: 'user-daniel', inviterName: 'Daniel Cuevas',
    vehicle: invitation.vehicle, type: 'entrada', method: 'QR', occurredAt: entered.record.occurredAt, authorized: true,
  })
  assert.ok(Number.isFinite(Date.parse(entered.record.occurredAt)))
  const exited = await access.validateToken(invitation.token)
  assert.equal(exited.authorized, true)
  assert.equal(exited.record.type, 'salida')
  assert.equal(exited.usedUses, 2)
  assert.equal(exited.status, 'completada')
  const afterExit = storage.get(DEMO_STORAGE_KEY)
  assert.equal((await access.validateToken(invitation.token)).reason, 'completed')
  assert.equal(storage.get(DEMO_STORAGE_KEY), afterExit)
  assert.deepEqual((await access.listAccessRecords()).map((record) => record.id).sort(), [entered.record.id, exited.record.id].sort())
  assert.notEqual(entered.record.id, exited.record.id)
  assert.deepEqual(await access.listActiveInvitations(), [])
  await login('residente@accesshome.demo')
  assert.equal((await invitations.getInvitation(invitation.id)).status, 'completada')
})

test('rechaza token vacío/inexistente sin consumir usos ni crear registros', async () => {
  await createInvitation()
  await login('admin@accesshome.demo')
  const before = storage.get(DEMO_STORAGE_KEY)
  for (const token of ['', ' ', 'token-inexistente']) {
    assert.deepEqual(await access.validateToken(token), { authorized: false, reason: 'not_found', message: 'Invitación inexistente.' })
  }
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
})

test('rechaza canceladas, expiradas y futuras; valida en el inicio y rechaza en la expiración exacta', async (context) => {
  const cancelled = await createInvitation()
  await invitations.cancelInvitation(cancelled.id)
  const now = Date.now()
  const scheduled = await createInvitation({ validity: { kind: 'custom', startsAt: new Date(now + 60000).toISOString(), expiresAt: new Date(now + 120000).toISOString() } })
  await login('admin@accesshome.demo')
  const before = storage.get(DEMO_STORAGE_KEY)
  assert.equal((await access.validateToken(cancelled.token)).reason, 'cancelled')
  assert.equal((await access.validateToken(scheduled.token)).reason, 'outside_period')
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
  context.mock.method(Date, 'now', () => now + 60000)
  assert.equal((await access.validateToken(scheduled.token)).record.type, 'entrada')
  context.mock.method(Date, 'now', () => now + 120000)
  const afterEntry = storage.get(DEMO_STORAGE_KEY)
  assert.equal((await access.validateToken(scheduled.token)).reason, 'expired')
  assert.equal((await access.validateToken(cancelled.token)).reason, 'cancelled')
  assert.equal(storage.get(DEMO_STORAGE_KEY), afterEntry)
})

test('cancelar después de entrada impide salida y conserva el registro', async () => {
  const invitation = await createInvitation()
  await login('admin@accesshome.demo')
  await access.validateToken(invitation.token)
  await login('residente@accesshome.demo')
  await invitations.cancelInvitation(invitation.id)
  await login('admin@accesshome.demo')
  assert.equal((await access.validateToken(invitation.token)).reason, 'cancelled')
  assert.equal((await access.listAccessRecords()).length, 1)
  assert.equal(read().invitations[0].usedUses, 1)
})

test('solo administrador valida y consulta movimientos; residentes y anónimos quedan bloqueados', async () => {
  const invitation = await createInvitation()
  for (const email of ['residente@accesshome.demo', 'mariana@accesshome.demo', null]) {
    if (email) await login(email)
    else await authService.logout()
    const before = storage.get(DEMO_STORAGE_KEY)
    for (const operation of [() => access.validateToken(invitation.token), () => access.listActiveInvitations(), () => access.listAccessRecords()]) {
      await assert.rejects(operation(), email ? /Solo el administrador/ : /Inicia sesión/)
    }
    assert.equal(storage.get(DEMO_STORAGE_KEY), before)
  }
})

test('administrador solo ve y valida invitaciones de su propio condominio', async () => {
  const invitation = await createInvitation()
  await login('admin@accesshome.demo')
  await access.validateToken(invitation.token)
  const data = read()
  data.condominiums.push({ id: 'other-condo', name: 'Otro condominio', address: 'Otra dirección' })
  data.users.push({ ...data.users[0], id: 'other-admin', email: 'other-admin@accesshome.demo', condominiumId: 'other-condo' })
  write(data)
  await login('other-admin@accesshome.demo')
  const before = storage.get(DEMO_STORAGE_KEY)
  assert.equal((await access.validateToken(invitation.token)).reason, 'not_found')
  assert.deepEqual(await access.listActiveInvitations(), [])
  assert.deepEqual(await access.listAccessRecords(), [])
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
})

test('casa inactiva rechaza acceso sin consumir usos; reactivar recupera el flujo', async () => {
  const invitation = await createInvitation()
  await login('admin@accesshome.demo')
  await communityService.updateResidence('house-24', { number: '24', street: 'Robles', active: false })
  assert.equal((await access.validateToken(invitation.token)).reason, 'inactive_residence')
  assert.equal(read().invitations[0].usedUses, 0)
  await communityService.updateResidence('house-24', { number: '24', street: 'Robles', active: true })
  assert.equal((await access.validateToken(invitation.token)).authorized, true)
})

test('llamadas consecutivas leen el último uso y jamás autorizan un tercer movimiento', async () => {
  const invitation = await createInvitation()
  await login('admin@accesshome.demo')
  const results = await Promise.all([access.validateToken(invitation.token), access.validateToken(invitation.token), access.validateToken(invitation.token)])
  assert.deepEqual(results.map((result) => result.authorized), [true, true, false])
  assert.equal(read().invitations[0].usedUses, 2)
  assert.equal(read().accessRecords.length, 2)
})

test('fallo de escritura no consume el uso ni guarda movimiento ni notifica; permite reintentar', async () => {
  const invitation = await createInvitation()
  await login('admin@accesshome.demo')
  const originalWrite = window.localStorage.setItem
  const before = storage.get(DEMO_STORAGE_KEY)
  let notifications = 0
  const unsubscribe = invitations.subscribe(() => notifications++)
  window.localStorage.setItem = () => { throw new Error('quota') }
  await assert.rejects(access.validateToken(invitation.token), /No se pudieron guardar/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
  assert.equal(notifications, 0)
  window.localStorage.setItem = originalWrite
  assert.equal((await access.validateToken(invitation.token)).record.type, 'entrada')
  assert.equal(notifications, 1)
  unsubscribe()
})

test('registros son snapshots, persisten al volver a entrar y reset elimina usos e historial', async () => {
  const invitation = await createInvitation()
  await login('admin@accesshome.demo')
  const entry = await access.validateToken(invitation.token)
  const original = structuredClone(entry.record)
  entry.record.vehicle.plates = 'CAMBIO-EXTERNO'
  await communityService.updateResidence('house-24', { number: '240', street: 'Otra calle', active: true })
  await authService.logout()
  await login('admin@accesshome.demo')
  assert.deepEqual((await access.listAccessRecords())[0], original)
  await demoService.resetDemoData()
  assert.deepEqual(read(), createDemoData())
})

test('migración v5 conserva tokens/snapshots/usos/cancelación y añade historial vacío una vez', async () => {
  const invitation = await createInvitation()
  await invitations.cancelInvitation(invitation.id)
  const { accessRecords: unused, ...old } = read()
  old.version = 5
  write(old)
  await invitations.getInvitation(invitation.id)
  assert.deepEqual(read(), { ...old, version: 7, accessRecords: [], reports: [] })
  const before = storage.get(DEMO_STORAGE_KEY)
  await invitations.getInvitation(invitation.id)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
})

test('registros corruptos o duplicados se rechazan sin sobrescribir datos', async () => {
  const invitation = await createInvitation()
  await login('admin@accesshome.demo')
  await access.validateToken(invitation.token)
  const original = read()
  for (const mutate of [
    (data) => { data.accessRecords[0].invitationId = 'missing' },
    (data) => { data.accessRecords[0].residenceId = 'house-12' },
    (data) => { data.accessRecords[0].method = 'other' },
    (data) => { data.accessRecords[0].authorized = false },
    (data) => { data.accessRecords[0].occurredAt = 'invalid' },
    (data) => { data.accessRecords[0].vehicle = { plates: '' } },
    (data) => { data.accessRecords.push({ ...data.accessRecords[0], id: 'duplicate-movement' }) },
  ]) {
    const data = structuredClone(original)
    mutate(data)
    write(data)
    await assert.rejects(access.listAccessRecords(), /datos locales no son válidos/)
    assert.deepEqual(read(), data)
  }
})
