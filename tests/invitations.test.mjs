import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { authService } from '../.test-build/services/authService.js'
import { invitationsService as invitations } from '../.test-build/services/invitationsService.js'
import { contactsService as contacts } from '../.test-build/services/contactsService.js'
import { communityService } from '../.test-build/services/communityService.js'
import { demoService } from '../.test-build/services/demoService.js'
import { createDemoData, DEMO_PASSWORD } from '../.test-build/data/demo.js'
import { DEMO_STORAGE_KEY } from '../.test-build/services/demoStorage.js'

let storage
const login = (email) => authService.login({ email, password: DEMO_PASSWORD })
const read = () => JSON.parse(storage.get(DEMO_STORAGE_KEY))
const write = (data) => storage.set(DEMO_STORAGE_KEY, JSON.stringify(data))
const vehicle = { plates: 'TMP-9081', brand: '', model: '', color: '' }
const occasional = { source: 'occasional', visitorName: 'Lucía Pérez', phone: '', vehicle: null, saveAsContact: false, validity: { kind: '24hours' } }
const fromCarlos = { source: 'contact', contactId: 'contact-carlos', vehicleChoice: { kind: 'saved', vehicleId: 'contact-vehicle-carlos' }, validity: { kind: 'today' } }

beforeEach(async () => {
  storage = new Map()
  globalThis.window = new EventTarget()
  window.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  await login('residente@accesshome.demo')
})

test('Carlos: snapshot, token único, casa automática y 2 usos sin consumir', async () => {
  const id = await invitations.createInvitation({ ...fromCarlos, inviterUserId: 'user-ana', maxUses: 99, usedUses: 1, status: 'cancelada' })
  const invitation = await invitations.getInvitation(id)
  assert.equal(invitation.visitorName, 'Carlos López')
  assert.equal(invitation.phone, '3312345678')
  assert.equal(invitation.contactId, 'contact-carlos')
  assert.equal(invitation.inviterUserId, 'user-daniel')
  assert.equal(invitation.residenceId, 'house-24')
  assert.equal(invitation.residenceName, 'Casa 24')
  assert.deepEqual(invitation.vehicle, { plates: 'JKL-1234', brand: 'Mazda', model: '3', color: '' })
  assert.equal(invitation.maxUses, 2)
  assert.equal(invitation.usedUses, 0)
  assert.equal(invitation.status, 'activa')
  const midnight = new Date(invitation.createdAt)
  midnight.setHours(24, 0, 0, 0)
  assert.equal(invitation.expiresAt, midnight.toISOString())
  assert.equal(invitation.startsAt, invitation.createdAt)
  const second = await invitations.getInvitation(await invitations.createInvitation(fromCarlos))
  assert.notEqual(second.id, invitation.id)
  assert.notEqual(second.token, invitation.token)
  assert.match(invitation.token, /^[\da-f-]{36}$/)
})

test('contactos con y sin vehículos pueden ser invitados sin vehículo', async () => {
  for (const contactId of ['contact-carlos', 'contact-maria']) {
    const id = await invitations.createInvitation({ ...fromCarlos, contactId, vehicleChoice: { kind: 'none' } })
    assert.equal((await invitations.getInvitation(id)).vehicle, null)
  }
})

test('visitante ocasional sin guardar, vehículo solo placas y vigencia de 24 horas', async () => {
  const before = read()
  const id = await invitations.createInvitation({ ...occasional, vehicle: { ...vehicle, plates: ' tmp-9081 ' } })
  const invitation = await invitations.getInvitation(id)
  assert.equal(invitation.visitorName, occasional.visitorName)
  assert.equal(invitation.contactId, null)
  assert.deepEqual(invitation.vehicle, vehicle)
  assert.equal(Date.parse(invitation.expiresAt) - Date.parse(invitation.startsAt), 86400000)
  for (const key of ['contacts', 'vehicles', 'users', 'inhabitants', 'residences']) assert.deepEqual(read()[key], before[key])
})

test('otro vehículo no cambia los vehículos guardados ni los permanentes', async () => {
  const before = read()
  const id = await invitations.createInvitation({ ...fromCarlos, vehicleChoice: { kind: 'other', vehicle } })
  assert.deepEqual((await invitations.getInvitation(id)).vehicle, vehicle)
  assert.deepEqual(read().contacts, before.contacts)
  assert.deepEqual(read().vehicles, before.vehicles)
})

test('guardar ocasional como contacto es opcional y conserva el vehículo sin crear cuenta', async () => {
  const users = read().users
  for (const visitVehicle of [vehicle, null]) {
    const id = await invitations.createInvitation({ ...occasional, vehicle: visitVehicle, saveAsContact: true })
    const invitation = await invitations.getInvitation(id)
    const contact = await contacts.getContact(invitation.contactId)
    assert.equal(contact.ownerUserId, 'user-daniel')
    assert.equal(contact.name, occasional.visitorName)
    assert.equal(contact.vehicles.length, visitVehicle ? 1 : 0)
    if (visitVehicle) assert.equal(contact.vehicles[0].plates, vehicle.plates)
  }
  assert.deepEqual(read().users, users)
})

test('vigencia personalizada acepta inicio futuro y rechaza rangos inválidos sin guardar', async () => {
  const start = new Date(Date.now() + 3600000).toISOString()
  const end = new Date(Date.now() + 7200000).toISOString()
  const id = await invitations.createInvitation({ ...occasional, validity: { kind: 'custom', startsAt: start, expiresAt: end } })
  const invitation = await invitations.getInvitation(id)
  assert.equal(invitation.startsAt, start)
  assert.equal(invitation.expiresAt, end)
  assert.equal(invitation.status, 'activa')
  const before = storage.get(DEMO_STORAGE_KEY)
  for (const validity of [
    { kind: 'custom', startsAt: start, expiresAt: start },
    { kind: 'custom', startsAt: end, expiresAt: start },
    { kind: 'custom', startsAt: 'invalid', expiresAt: end },
    { kind: 'custom', startsAt: '2020-01-01', expiresAt: '2020-01-02' },
    { kind: 'unknown' },
  ]) await assert.rejects(invitations.createInvitation({ ...occasional, validity }), /fecha|fechas|vigencia/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
})

test('cancelar conserva historial y rechaza una segunda cancelación', async () => {
  const id = await invitations.createInvitation(fromCarlos)
  const original = await invitations.getInvitation(id)
  await invitations.cancelInvitation(id)
  assert.deepEqual(await invitations.getInvitation(id), { ...original, status: 'cancelada' })
  await assert.rejects(invitations.cancelInvitation(id), /Solo se puede cancelar/)
  assert.equal((await invitations.listInvitations('', 'cancelada')).length, 1)
  assert.equal((await invitations.listInvitations('', 'activa')).length, 0)
})

test('snapshot permanece tras editar y eliminar contacto/vehículo y renombrar casa', async () => {
  const id = await invitations.createInvitation(fromCarlos)
  const original = await invitations.getInvitation(id)
  const carlos = await contacts.getContact('contact-carlos')
  await contacts.updateContact(carlos.id, { ...carlos, name: 'Carlos editado', phone: '9999' })
  await contacts.updateVehicle(carlos.id, carlos.vehicles[0].id, { ...vehicle, brand: 'Toyota', model: 'Tacoma', plates: 'XYZ-9999', active: true })
  assert.deepEqual(await invitations.getInvitation(id), original)
  await contacts.deleteVehicle(carlos.id, carlos.vehicles[0].id)
  await contacts.deleteContact(carlos.id)
  await login('admin@accesshome.demo')
  await communityService.updateResidence('house-24', { number: '240', street: 'Otra calle', active: true })
  await login('residente@accesshome.demo')
  assert.deepEqual(await invitations.getInvitation(id), original)
})

test('otra casa y otro contacto se rechazan en service, sin escrituras parciales', async () => {
  await login('ana@accesshome.demo')
  const foreignInvitation = await invitations.createInvitation(occasional)
  const foreignContact = await contacts.createContact({ name: 'Privado', phone: '', email: '', notes: '', active: true })
  await login('residente@accesshome.demo')
  const before = storage.get(DEMO_STORAGE_KEY)
  await assert.rejects(invitations.createInvitation({ ...occasional, residenceId: 'house-12' }), /otra residencia/)
  await assert.rejects(invitations.createInvitation({ ...fromCarlos, contactId: foreignContact, vehicleChoice: { kind: 'none' } }), /propios contactos/)
  await assert.rejects(invitations.getInvitation(foreignInvitation), /tu residencia/)
  await assert.rejects(invitations.cancelInvitation(foreignInvitation), /tu residencia/)
  assert.deepEqual(await invitations.listInvitations(), [])
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
})

test('administrador y anónimo no consultan ni generan; habitante adicional solo lee su casa', async () => {
  const id = await invitations.createInvitation(occasional)
  await login('mariana@accesshome.demo')
  assert.equal((await invitations.getContext()).canManage, false)
  assert.equal((await invitations.getInvitation(id)).residenceId, 'house-24')
  await assert.rejects(invitations.createInvitation(occasional), /principal/)
  await assert.rejects(invitations.cancelInvitation(id), /principal/)
  for (const email of ['admin@accesshome.demo', null]) {
    if (email) await login(email)
    else await authService.logout()
    for (const operation of [() => invitations.getContext(), () => invitations.listInvitations(), () => invitations.getInvitation(id), () => invitations.createInvitation(occasional), () => invitations.cancelInvitation(id)]) {
      await assert.rejects(operation(), email ? /corresponden a los residentes/ : /Inicia sesión/)
    }
  }
})

test('casa inactiva bloquea crear/cancelar pero mantiene la consulta', async () => {
  const id = await invitations.createInvitation(occasional)
  await login('admin@accesshome.demo')
  await communityService.updateResidence('house-24', { number: '24', street: 'Circuito Robles', active: false })
  await login('residente@accesshome.demo')
  assert.equal((await invitations.getContext()).canManage, false)
  assert.equal((await invitations.getInvitation(id)).id, id)
  await assert.rejects(invitations.createInvitation(occasional), /inactiva/)
  await assert.rejects(invitations.cancelInvitation(id), /inactiva/)
})

test('cambiar principal revoca gestión al anterior y conserva invitador histórico', async () => {
  const id = await invitations.createInvitation(occasional)
  await login('admin@accesshome.demo')
  await communityService.assignPrincipal('house-24', { inhabitantId: 'inhabitant-user-mariana' })
  await login('residente@accesshome.demo')
  await assert.rejects(invitations.cancelInvitation(id), /principal/)
  await login('mariana@accesshome.demo')
  await invitations.cancelInvitation(id)
  assert.equal((await invitations.getInvitation(id)).inviterUserId, 'user-daniel')
})

test('rechaza nombre/placas vacíos, vehículo ajeno, contacto y vehículo inactivos', async () => {
  const before = storage.get(DEMO_STORAGE_KEY)
  await assert.rejects(invitations.createInvitation({ ...occasional, visitorName: ' ' }), /Nombre/)
  await assert.rejects(invitations.createInvitation({ ...occasional, vehicle: { ...vehicle, plates: '' } }), /Placas/)
  await assert.rejects(invitations.createInvitation({ ...fromCarlos, vehicleChoice: { kind: 'saved', vehicleId: 'contact-vehicle-pedro' } }), /vehículo activo de este contacto/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
  const carlos = await contacts.getContact('contact-carlos')
  await contacts.updateVehicle(carlos.id, carlos.vehicles[0].id, { ...carlos.vehicles[0], active: false })
  await assert.rejects(invitations.createInvitation(fromCarlos), /vehículo activo/)
  await contacts.updateContact(carlos.id, { ...carlos, active: false })
  await assert.rejects(invitations.createInvitation({ ...fromCarlos, vehicleChoice: { kind: 'none' } }), /Reactiva el contacto/)
})

test('expiración y usos determinan los estados incluso sin recargar, sin alterar snapshots', async (context) => {
  const id = await invitations.createInvitation(occasional)
  const original = await invitations.getInvitation(id)
  context.mock.method(Date, 'now', () => Date.parse(original.expiresAt))
  assert.equal((await invitations.getInvitation(id)).status, 'expirada')
  assert.equal((await invitations.listInvitations('', 'expirada')).length, 1)
  await assert.rejects(invitations.cancelInvitation(id), /Solo se puede cancelar/)
  const data = read()
  data.invitations[0].usedUses = 2
  write(data)
  assert.equal((await invitations.getInvitation(id)).status, 'completada')
  assert.equal((await invitations.listInvitations('', 'completada')).length, 1)
  await assert.rejects(invitations.cancelInvitation(id), /Solo se puede cancelar/)
  data.invitations[0].status = 'cancelada'
  write(data)
  assert.equal((await invitations.getInvitation(id)).status, 'cancelada')
})

test('búsqueda por nombre sin acento, teléfono y placas; sesión persistida y copias aisladas', async () => {
  await invitations.createInvitation(fromCarlos)
  const id = await invitations.createInvitation(occasional)
  assert.equal((await invitations.listInvitations('lucia'))[0].id, id)
  assert.equal((await invitations.listInvitations('LÓPEZ')).length, 1)
  assert.equal((await invitations.listInvitations('331234')).length, 1)
  assert.equal((await invitations.listInvitations('jkl')).length, 1)
  assert.deepEqual(await invitations.listInvitations('inexistente'), [])
  const original = await invitations.getInvitation(id)
  const copy = await invitations.getInvitation(id)
  copy.visitorName = 'Alterado'
  assert.deepEqual(await invitations.getInvitation(id), original)
  await authService.logout()
  await login('residente@accesshome.demo')
  assert.deepEqual(await invitations.getInvitation(id), original)
})

test('escritura fallida no crea contacto ni invitación ni notifica éxito; reset restaura todo', async () => {
  const setItem = window.localStorage.setItem
  const before = storage.get(DEMO_STORAGE_KEY)
  let notifications = 0
  const unsubscribe = invitations.subscribe(() => notifications++)
  window.localStorage.setItem = () => { throw new Error('quota') }
  await assert.rejects(invitations.createInvitation({ ...occasional, vehicle, saveAsContact: true }), /No se pudieron guardar/)
  assert.equal(notifications, 0)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
  window.localStorage.setItem = setItem
  const id = await invitations.createInvitation(occasional)
  window.localStorage.setItem = () => { throw new Error('quota') }
  await assert.rejects(invitations.cancelInvitation(id), /No se pudieron guardar/)
  assert.equal((await invitations.getInvitation(id)).status, 'activa')
  window.localStorage.setItem = setItem
  await demoService.resetDemoData()
  assert.deepEqual(read(), createDemoData())
  unsubscribe()
})

test('migra v4 conservando todos sus datos; no recupera contactos eliminados ni repite migración', async () => {
  await contacts.deleteContact('contact-carlos')
  const { invitations: unused, ...old } = read()
  old.version = 4
  write(old)
  assert.deepEqual(await invitations.listInvitations(), [])
  assert.deepEqual(read(), { ...old, version: 5, invitations: [] })
  const id = await invitations.createInvitation(occasional)
  assert.equal((await invitations.listInvitations())[0].id, id)
  assert.equal((await contacts.listContacts()).length, 2)
})

test('datos de invitaciones corruptos se rechazan sin sobrescribir el almacenamiento', async () => {
  await invitations.createInvitation(occasional)
  const original = read()
  for (const mutate of [
    (data) => { data.invitations[0].token = '' },
    (data) => { data.invitations[0].residenceId = 'missing' },
    (data) => { data.invitations[0].inviterUserId = 'user-admin' },
    (data) => { data.invitations[0].usedUses = -1 },
    (data) => { data.invitations[0].status = 'completada' },
    (data) => { data.invitations[0].expiresAt = 'invalid' },
    (data) => { data.invitations.push({ ...data.invitations[0], id: 'other' }) },
  ]) {
    const data = structuredClone(original)
    mutate(data)
    write(data)
    await assert.rejects(invitations.listInvitations(), /datos locales no son válidos/)
    assert.deepEqual(read(), data)
  }
})
