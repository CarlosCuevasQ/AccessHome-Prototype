import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { authService } from '../.test-build/services/authService.js'
import { contactsService as contacts } from '../.test-build/services/contactsService.js'
import { communityService } from '../.test-build/services/communityService.js'
import { demoService } from '../.test-build/services/demoService.js'
import { createDemoData, DEMO_PASSWORD } from '../.test-build/data/demo.js'
import { DEMO_STORAGE_KEY } from '../.test-build/services/demoStorage.js'

let storage
const login = (email) => authService.login({ email, password: DEMO_PASSWORD })
const daniel = () => login('residente@accesshome.demo')
const admin = () => login('admin@accesshome.demo')
const input = { name: 'Laura Pérez', phone: '', email: '', notes: '', active: true }
const vehicle = { plates: 'ABC-9012', brand: '', model: '', color: '', active: true }
const read = () => JSON.parse(storage.get(DEMO_STORAGE_KEY))

beforeEach(async () => {
  storage = new Map()
  globalThis.window = new EventTarget()
  window.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  await daniel()
})

test('semilla privada de Daniel con contactos con cero y un vehículo', async () => {
  const list = await contacts.listContacts()
  assert.deepEqual(list.map((contact) => contact.name), ['Carlos López', 'María González', 'Pedro Ramírez'])
  assert.equal(list[0].phone, '3312345678')
  assert.equal(list[0].vehicles[0].plates, 'JKL-1234')
  assert.equal(list[1].vehicles.length, 0)
  assert.equal(list[2].vehicles[0].plates, 'HJK-7821')
  assert.ok(list.every((contact) => contact.ownerUserId === 'user-daniel'))
})

test('alta con solo nombre, edición y desactivación reversible sin crear cuenta ni acceso', async () => {
  const before = read()
  const id = await contacts.createContact({ ...input, ownerUserId: 'user-ana', vehicles: [vehicle] })
  let contact = await contacts.getContact(id)
  assert.equal(contact.ownerUserId, 'user-daniel')
  assert.deepEqual(contact.vehicles, [])
  await contacts.updateContact(id, { ...input, name: 'Laura Pérez Díaz', phone: '3312345000', email: 'LAURA@example.test', notes: 'Visita familiar', active: false, ownerUserId: 'user-ana', id: 'spoof' })
  contact = await contacts.getContact(id)
  assert.equal(contact.id, id)
  assert.equal(contact.ownerUserId, 'user-daniel')
  assert.equal(contact.name, 'Laura Pérez Díaz')
  assert.equal(contact.email, 'laura@example.test')
  assert.equal(contact.active, false)
  await contacts.updateContact(id, { ...contact, active: true })
  assert.equal((await contacts.getContact(id)).active, true)
  const after = read()
  for (const key of ['users', 'residences', 'inhabitants', 'vehicles', 'session']) assert.deepEqual(after[key], before[key])
})

test('varios vehículos con solo placas; editar, desactivar y reactivar sin mezclar con residencia', async () => {
  const permanent = read().vehicles
  await contacts.createVehicle('contact-maria', vehicle)
  await contacts.createVehicle('contact-maria', { ...vehicle, plates: 'ABC-9013' })
  let contact = await contacts.getContact('contact-maria')
  assert.equal(contact.vehicles.length, 2)
  const id = contact.vehicles[0].id
  await contacts.updateVehicle(contact.id, id, { ...vehicle, plates: 'ABC-9014', brand: 'Mazda', model: '3', color: 'Azul', active: false, id: 'spoof' })
  contact = await contacts.getContact(contact.id)
  assert.deepEqual(contact.vehicles[0], { ...vehicle, id, plates: 'ABC-9014', brand: 'Mazda', model: '3', color: 'Azul', active: false })
  await contacts.updateVehicle(contact.id, id, { ...contact.vehicles[0], active: true })
  await contacts.updateContact(contact.id, { ...contact, active: false })
  assert.equal((await contacts.getContact(contact.id)).vehicles[0].active, true)
  assert.deepEqual(read().vehicles, permanent)
})

test('búsqueda ignora acentos/mayúsculas e incluye teléfono, correo, placas e inactivos', async () => {
  await contacts.createContact({ ...input, active: false, email: 'laura@example.test' })
  assert.equal((await contacts.listContacts('maria'))[0].name, 'María González')
  assert.equal((await contacts.listContacts('LÓPEZ'))[0].name, 'Carlos López')
  assert.equal((await contacts.listContacts('331234'))[0].id, 'contact-carlos')
  assert.equal((await contacts.listContacts('hjk'))[0].id, 'contact-pedro')
  assert.equal((await contacts.listContacts('laura@example'))[0].active, false)
  assert.deepEqual(await contacts.listContacts('noexiste'), [])
})

test('validaciones y duplicados se limitan al contacto y no escriben tras un error', async () => {
  const before = storage.get(DEMO_STORAGE_KEY)
  await assert.rejects(contacts.createContact({ ...input, name: ' ' }), /Nombre/)
  await assert.rejects(contacts.createContact({ ...input, email: 'inválido' }), /correo electrónico válido/)
  await assert.rejects(contacts.createContact({ ...input, notes: 'a'.repeat(1001) }), /Notas/)
  await assert.rejects(contacts.createVehicle('contact-maria', { ...vehicle, plates: '' }), /Placas/)
  await assert.rejects(contacts.createVehicle('contact-carlos', { ...vehicle, plates: 'jkl 1234' }), /ya están registradas/)
  await assert.rejects(contacts.createVehicle('contact-maria', { ...vehicle, brand: 'a'.repeat(61) }), /Marca/)
  await assert.rejects(contacts.updateContact('contact-maria', { ...input, active: 'true' }), /estado válido/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
  await contacts.createVehicle('contact-maria', { ...vehicle, plates: 'DEMO-024' })
  await contacts.createVehicle('contact-maria', { ...vehicle, plates: 'JKL-1234' })
  assert.equal((await contacts.getContact('contact-maria')).vehicles.length, 2)
})

test('otro principal no consulta ni modifica contactos ajenos por ninguna operación', async () => {
  await login('ana@accesshome.demo')
  const ownId = await contacts.createContact({ ...input, name: 'Contacto privado de Ana' })
  assert.deepEqual((await contacts.listContacts()).map((contact) => contact.id), [ownId])
  await daniel()
  const before = storage.get(DEMO_STORAGE_KEY)
  for (const call of [
    () => contacts.getContact(ownId),
    () => contacts.updateContact(ownId, input),
    () => contacts.createVehicle(ownId, vehicle),
    () => contacts.updateVehicle(ownId, 'cualquier-id', vehicle),
  ]) await assert.rejects(call(), /Solo puedes acceder a tus propios contactos/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
  assert.equal((await contacts.listContacts('privado')).length, 0)
})

test('no puede cambiar un vehículo ajeno enviando el ID de un contacto propio', async () => {
  const before = storage.get(DEMO_STORAGE_KEY)
  await assert.rejects(contacts.updateVehicle('contact-maria', 'contact-vehicle-carlos', vehicle), /No se encontró ese vehículo/)
  await assert.rejects(contacts.getContact('no-existe'), /Contacto no disponible/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
})

test('administrador, habitante adicional y sesión anónima carecen de agenda', async () => {
  for (const email of ['admin@accesshome.demo', 'mariana@accesshome.demo', null]) {
    if (email) await login(email)
    else await authService.logout()
    for (const call of [
      () => contacts.getAccess(), () => contacts.listContacts(), () => contacts.getContact('contact-carlos'),
      () => contacts.createContact(input), () => contacts.updateContact('contact-carlos', input),
      () => contacts.createVehicle('contact-carlos', vehicle), () => contacts.updateVehicle('contact-carlos', 'contact-vehicle-carlos', vehicle),
    ]) await assert.rejects(call(), email ? /únicamente para el residente principal/ : /Inicia sesión/)
  }
})

test('cambiar principal no transfiere agenda y revoca acceso del propietario anterior', async () => {
  await admin()
  await communityService.assignPrincipal('house-24', { inhabitantId: 'inhabitant-user-mariana' })
  await daniel()
  await assert.rejects(contacts.listContacts(), /residente principal/)
  await login('mariana@accesshome.demo')
  assert.deepEqual(await contacts.listContacts(), [])
  await assert.rejects(contacts.getContact('contact-carlos'), /propios contactos/)
  await admin()
  await communityService.assignPrincipal('house-24', { inhabitantId: 'inhabitant-user-daniel' })
  await daniel()
  assert.equal((await contacts.listContacts()).length, 3)
})

test('residencia inactiva conserva lectura privada pero bloquea todas las escrituras', async () => {
  await admin()
  await communityService.updateResidence('house-24', { number: '24', street: 'Circuito Robles', active: false })
  await daniel()
  assert.equal((await contacts.getAccess()).canManage, false)
  assert.equal((await contacts.listContacts()).length, 3)
  for (const call of [
    () => contacts.createContact(input), () => contacts.updateContact('contact-carlos', input),
    () => contacts.createVehicle('contact-carlos', vehicle), () => contacts.updateVehicle('contact-carlos', 'contact-vehicle-carlos', vehicle),
  ]) await assert.rejects(call(), /residencia está inactiva/)
})

test('migración v3 añade agenda una vez y preserva comunidad, principal y sesión', async () => {
  const { contacts: ignored, ...old } = read()
  old.version = 3
  old.residences[0].street = 'Calle conservada'
  old.residences[0].active = false
  old.inhabitants.find((person) => person.userId === 'user-mariana').active = false
  storage.set(DEMO_STORAGE_KEY, JSON.stringify(old))
  assert.equal((await contacts.listContacts()).length, 3)
  const migrated = read()
  for (const key of ['users', 'residences', 'inhabitants', 'vehicles', 'session']) assert.deepEqual(migrated[key], old[key])
  assert.equal(migrated.version, 5)
  await contacts.updateContact('contact-carlos', { ...input, name: 'Nombre editado' })
  assert.equal((await contacts.getContact('contact-carlos')).name, 'Nombre editado')
  assert.equal((await contacts.listContacts()).length, 3)
})

test('fallos de escritura no notifican éxito ni destruyen datos; restaurar incluye contactos', async () => {
  const originalWrite = window.localStorage.setItem
  let notified = 0
  const unsubscribe = contacts.subscribe(() => notified++)
  const before = storage.get(DEMO_STORAGE_KEY)
  window.localStorage.setItem = () => { throw new Error('quota') }
  await assert.rejects(contacts.createContact(input), /No se pudieron guardar/)
  await assert.rejects(contacts.createVehicle('contact-maria', vehicle), /No se pudieron guardar/)
  assert.equal(notified, 0)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
  const { contacts: ignored, ...old } = read()
  old.version = 3
  storage.set(DEMO_STORAGE_KEY, JSON.stringify(old))
  await assert.rejects(contacts.listContacts(), /No se pudieron guardar/)
  assert.deepEqual(read(), old)
  window.localStorage.setItem = originalWrite
  await contacts.createContact(input)
  await contacts.createVehicle('contact-maria', vehicle)
  await demoService.resetDemoData()
  assert.deepEqual(read(), createDemoData())
  assert.equal(await authService.getSession(), null)
  unsubscribe()
})

test('datos corruptos de agenda se rechazan sin sobrescribirlos', async () => {
  for (const mutate of [
    (data) => { data.contacts[0].ownerUserId = 'user-admin' },
    (data) => { data.contacts[0].vehicles[0].active = 'sí' },
    (data) => { data.contacts.push(data.contacts[0]) },
    (data) => { data.contacts[1].vehicles.push(data.contacts[0].vehicles[0]) },
  ]) {
    const data = createDemoData()
    mutate(data)
    storage.set(DEMO_STORAGE_KEY, JSON.stringify(data))
    await assert.rejects(authService.getSession(), /datos locales no son válidos/)
    assert.deepEqual(read(), data)
  }
})
