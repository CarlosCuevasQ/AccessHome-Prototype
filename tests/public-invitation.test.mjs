import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { authService } from '../.test-build/services/authService.js'
import { invitationsService as invitations } from '../.test-build/services/invitationsService.js'
import { publicInvitationService as visitor } from '../.test-build/services/publicInvitationService.js'
import { accessService } from '../.test-build/services/accessService.js'
import { communityService } from '../.test-build/services/communityService.js'
import { createDemoData } from '../.test-build/data/demo.js'
import { DEMO_STORAGE_KEY } from '../.test-build/services/demoStorage.js'

let storage
let invitation
const login = (email) => authService.login({ email, password: '' })
const read = () => JSON.parse(storage.get(DEMO_STORAGE_KEY))
const vehicle = { plates: 'VIS-7788', brand: '', model: '', color: '' }
const input = { source: 'occasional', visitorName: 'Visitante público', phone: '3312345678', vehicle: null, saveAsContact: false, validity: { kind: '24hours' } }

beforeEach(async () => {
  storage = new Map()
  globalThis.window = new EventTarget()
  window.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  await login('residente@accesshome.demo')
  invitation = await invitations.getInvitation(await invitations.createInvitation(input))
  await authService.logout()
})

test('token permite lectura sin sesión con proyección pública y sin datos privados', async () => {
  const before = storage.get(DEMO_STORAGE_KEY)
  const publicView = await visitor.getInvitation(invitation.token)
  assert.deepEqual(Object.keys(publicView).sort(), ['token', 'visitorName', 'residenceName', 'inviterName', 'startsAt', 'expiresAt', 'vehicle', 'status', 'usedUses', 'maxUses', 'canAddVehicle'].sort())
  assert.equal(publicView.visitorName, invitation.visitorName)
  assert.equal(publicView.residenceName, 'Casa 24')
  assert.equal(publicView.inviterName, 'Daniel Cuevas')
  assert.equal(publicView.canAddVehicle, true)
  assert.equal(publicView.vehicle, null)
  assert.equal(await authService.getSession(), null)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
})

test('agrega solo placas sin sesión y solo a esa invitación, una única vez', async () => {
  const before = read()
  await visitor.addVehicle(invitation.token, { ...vehicle, plates: ' vis-7788 ', residenceId: 'house-12', status: 'completada' })
  const publicView = await visitor.getInvitation(invitation.token)
  assert.deepEqual(publicView.vehicle, vehicle)
  assert.equal(publicView.canAddVehicle, false)
  const after = read()
  assert.deepEqual(after.invitations[0], { ...invitation, vehicle })
  for (const key of ['contacts', 'vehicles', 'users', 'inhabitants', 'residences', 'session', 'accessRecords']) assert.deepEqual(after[key], before[key])
  await assert.rejects(visitor.addVehicle(invitation.token, { ...vehicle, plates: 'OTRAS' }), /Solo puedes añadir/)
  assert.deepEqual(read(), after)
})

test('vehículo agregado se refleja en residente, entrada y salida sin modificar la agenda', async () => {
  await visitor.addVehicle(invitation.token, vehicle)
  await login('residente@accesshome.demo')
  assert.deepEqual((await invitations.getInvitation(invitation.id)).vehicle, vehicle)
  await login('admin@accesshome.demo')
  const entry = await accessService.validateToken(invitation.token)
  const exit = await accessService.validateToken(invitation.token)
  assert.deepEqual(entry.record.vehicle, vehicle)
  assert.deepEqual(exit.record.vehicle, vehicle)
  await authService.logout()
  const completed = await visitor.getInvitation(invitation.token)
  assert.equal(completed.status, 'completada')
  assert.equal(completed.usedUses, 2)
})

test('un vehículo original de contacto no puede sustituirse desde la vista pública', async () => {
  await login('residente@accesshome.demo')
  const id = await invitations.createInvitation({ source: 'contact', contactId: 'contact-carlos', vehicleChoice: { kind: 'saved', vehicleId: 'contact-vehicle-carlos' }, validity: { kind: 'today' } })
  const original = await invitations.getInvitation(id)
  await authService.logout()
  assert.equal((await visitor.getInvitation(original.token)).canAddVehicle, false)
  await assert.rejects(visitor.addVehicle(original.token, vehicle), /Solo puedes añadir/)
  assert.equal((await visitor.getInvitation(original.token)).vehicle.plates, 'JKL-1234')
})

test('rechaza placas inválidas y token inexistente sin guardar ni alterar otros campos', async () => {
  const before = storage.get(DEMO_STORAGE_KEY)
  await assert.rejects(visitor.getInvitation('missing'), /Invitación no disponible/)
  await assert.rejects(visitor.addVehicle('missing', vehicle), /Invitación no disponible/)
  await assert.rejects(visitor.addVehicle(invitation.token, { ...vehicle, plates: ' ' }), /Placas/)
  await assert.rejects(visitor.addVehicle(invitation.token, { ...vehicle, plates: '<bad>' }), /placas solo admiten/)
  await assert.rejects(visitor.addVehicle(invitation.token, { ...vehicle, model: 'x'.repeat(61) }), /60 caracteres/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
})

test('después de entrada sin vehículo no permite agregarlo; conserva ambos registros sin vehículo', async () => {
  await login('admin@accesshome.demo')
  await accessService.validateToken(invitation.token)
  await authService.logout()
  assert.equal((await visitor.getInvitation(invitation.token)).canAddVehicle, false)
  await assert.rejects(visitor.addVehicle(invitation.token, vehicle), /antes de su primer uso/)
  await login('admin@accesshome.demo')
  await accessService.validateToken(invitation.token)
  assert.ok((await accessService.listAccessRecords()).every((record) => record.vehicle === null))
})

test('cancelada/expirada/completada mantienen consulta pública y bloquean agregar vehículo', async (context) => {
  await login('residente@accesshome.demo')
  const cancelled = await invitations.getInvitation(await invitations.createInvitation(input))
  await invitations.cancelInvitation(cancelled.id)
  const completed = await invitations.getInvitation(await invitations.createInvitation(input))
  await login('admin@accesshome.demo')
  await accessService.validateToken(completed.token)
  await accessService.validateToken(completed.token)
  await authService.logout()
  context.mock.method(Date, 'now', () => Date.parse(invitation.expiresAt) + 60000)
  for (const [item, status] of [[invitation, 'expirada'], [cancelled, 'cancelada'], [completed, 'completada']]) {
    const publicView = await visitor.getInvitation(item.token)
    assert.equal(publicView.status, status)
    assert.equal(publicView.canAddVehicle, false)
    await assert.rejects(visitor.addVehicle(item.token, vehicle), /Solo puedes añadir/)
  }
})

test('casa inactiva bloquea agregar vehículo; inicio futuro admite preparación previa', async () => {
  await login('admin@accesshome.demo')
  await communityService.updateResidence('house-24', { number: '24', street: 'Robles', active: false })
  await assert.rejects(visitor.addVehicle(invitation.token, vehicle), /Solo puedes añadir/)
  await communityService.updateResidence('house-24', { number: '24', street: 'Robles', active: true })
  await login('residente@accesshome.demo')
  const startsAt = new Date(Date.now() + 3600000).toISOString()
  const expiresAt = new Date(Date.now() + 7200000).toISOString()
  const future = await invitations.getInvitation(await invitations.createInvitation({ ...input, validity: { kind: 'custom', startsAt, expiresAt } }))
  await authService.logout()
  await visitor.addVehicle(future.token, vehicle)
  assert.deepEqual((await visitor.getInvitation(future.token)).vehicle, vehicle)
})

test('fallo de guardado público conserva la invitación sin vehículo y permite reintentar', async () => {
  const before = storage.get(DEMO_STORAGE_KEY)
  const originalWrite = window.localStorage.setItem
  window.localStorage.setItem = () => { throw new Error('quota') }
  await assert.rejects(visitor.addVehicle(invitation.token, vehicle), /No se pudieron guardar/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
  window.localStorage.setItem = originalWrite
  await visitor.addVehicle(invitation.token, vehicle)
  assert.deepEqual((await visitor.getInvitation(invitation.token)).vehicle, vehicle)
})

