import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { authService } from '../.test-build/services/authService.js'
import { contactsService } from '../.test-build/services/contactsService.js'
import { communityService } from '../.test-build/services/communityService.js'
import { demoService } from '../.test-build/services/demoService.js'
import { createDemoData } from '../.test-build/data/demo.js'
import { DEMO_STORAGE_KEY } from '../.test-build/services/demoStorage.js'

let storage
const login = (email) => authService.login({ email, password: '' })
const read = () => JSON.parse(storage.get(DEMO_STORAGE_KEY))
const deletions = () => [
  () => contactsService.deleteContact('contact-carlos'),
  () => contactsService.deleteVehicle('contact-carlos', 'contact-vehicle-carlos'),
  () => communityService.deleteVehicle('house-24', 'vehicle-1'),
]

beforeEach(async () => {
  storage = new Map()
  globalThis.window = new EventTarget()
  window.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  await login('residente@accesshome.demo')
})

test('elimina contacto con sus vehículos, preserva otras agendas y comunidad y no reaparece al leer', async () => {
  const before = read()
  await contactsService.deleteContact('contact-carlos')
  assert.deepEqual(read().contacts, before.contacts.filter((contact) => contact.id !== 'contact-carlos'))
  for (const key of ['users', 'residences', 'inhabitants', 'vehicles', 'session']) assert.deepEqual(read()[key], before[key])
  await assert.rejects(contactsService.getContact('contact-carlos'), /Contacto no disponible/)
  await assert.rejects(contactsService.deleteContact('contact-carlos'), /Contacto no disponible/)
  assert.equal((await contactsService.listContacts()).length, 2)
})

test('elimina vehículo de contacto sin borrar contacto, otros vehículos ni vehículos permanentes', async () => {
  await contactsService.createVehicle('contact-carlos', { plates: 'OTRO-123', brand: '', model: '', color: '', active: false })
  const before = read()
  await contactsService.deleteVehicle('contact-carlos', 'contact-vehicle-carlos')
  const contact = await contactsService.getContact('contact-carlos')
  assert.equal(contact.vehicles.length, 1)
  assert.equal(contact.vehicles[0].plates, 'OTRO-123')
  assert.equal(contact.name, 'Carlos López')
  assert.deepEqual(read().vehicles, before.vehicles)
  await assert.rejects(contactsService.deleteVehicle('contact-carlos', 'contact-vehicle-carlos'), /No se encontró/)
})

test('elimina vehículo permanente, actualiza resumen y conserva casa, habitantes y agenda', async () => {
  const before = read()
  await communityService.deleteVehicle('house-24', 'vehicle-1')
  assert.deepEqual(read().vehicles, before.vehicles.filter((vehicle) => vehicle.id !== 'vehicle-1'))
  for (const key of ['residences', 'inhabitants', 'contacts']) assert.deepEqual(read()[key], before[key])
  assert.equal((await communityService.getResidence()).vehicles.length, 1)
  await login('admin@accesshome.demo')
  const summary = await communityService.getSummary()
  assert.equal(summary.vehicleCount, 4)
  assert.equal(summary.activeVehicleCount, 3)
})

test('rechaza eliminaciones ajenas, IDs cruzados, administrador, habitantes adicionales y anónimos', async () => {
  let before = storage.get(DEMO_STORAGE_KEY)
  await assert.rejects(communityService.deleteVehicle('house-12', 'vehicle-12'), /propia residencia/)
  await assert.rejects(communityService.deleteVehicle('house-24', 'vehicle-12'), /No se encontró/)
  await assert.rejects(contactsService.deleteVehicle('contact-maria', 'contact-vehicle-carlos'), /No se encontró/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
  for (const email of ['ana@accesshome.demo', 'admin@accesshome.demo', 'mariana@accesshome.demo', null]) {
    if (email) await login(email)
    else await authService.logout()
    before = storage.get(DEMO_STORAGE_KEY)
    for (const remove of deletions()) await assert.rejects(remove())
    assert.equal(storage.get(DEMO_STORAGE_KEY), before)
  }
})

test('revalida el principal y el estado de la residencia al eliminar', async () => {
  await login('admin@accesshome.demo')
  await communityService.updateResidence('house-24', { number: '24', street: 'Circuito Robles', active: false })
  await login('residente@accesshome.demo')
  for (const remove of deletions()) await assert.rejects(remove(), /inactiva/)
  await login('admin@accesshome.demo')
  await communityService.updateResidence('house-24', { number: '24', street: 'Circuito Robles', active: true })
  await communityService.assignPrincipal('house-24', { inhabitantId: 'inhabitant-user-mariana' })
  await login('residente@accesshome.demo')
  for (const remove of deletions()) await assert.rejects(remove(), /residente principal/)
})

test('fallo de guardado no elimina ni notifica; restauración recupera los registros demo borrados', async () => {
  const originalWrite = window.localStorage.setItem
  let notifications = 0
  const unsubscribe = contactsService.subscribe(() => notifications++)
  const before = storage.get(DEMO_STORAGE_KEY)
  window.localStorage.setItem = () => { throw new Error('quota') }
  for (const remove of deletions()) await assert.rejects(remove(), /No se pudieron guardar/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
  assert.equal(notifications, 0)
  window.localStorage.setItem = originalWrite
  await contactsService.deleteContact('contact-carlos')
  await contactsService.deleteVehicle('contact-pedro', 'contact-vehicle-pedro')
  await communityService.deleteVehicle('house-24', 'vehicle-1')
  await demoService.resetDemoData()
  assert.deepEqual(read(), createDemoData())
  unsubscribe()
})

