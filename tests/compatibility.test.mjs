import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { test } from 'node:test'
import { generateId } from '../.test-build/utils/id.js'
import { cloneJsonData } from '../.test-build/utils/clone.js'
import { createDemoData, DEMO_PASSWORD } from '../.test-build/data/demo.js'
import { migrateDemoData } from '../.test-build/services/demoMigration.js'
import { authService } from '../.test-build/services/authService.js'
import { communityService } from '../.test-build/services/communityService.js'
import { contactsService } from '../.test-build/services/contactsService.js'
import { invitationsService } from '../.test-build/services/invitationsService.js'
import { publicInvitationService } from '../.test-build/services/publicInvitationService.js'
import { accessService } from '../.test-build/services/accessService.js'
import { DEMO_STORAGE_KEY } from '../.test-build/services/demoStorage.js'

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const cryptoWithoutUUID = { getRandomValues: (bytes) => webcrypto.getRandomValues(bytes) }

function replaceGlobal(t, name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  })
}

test('generateId prioriza randomUUID y conserva el receptor de la API', (t) => {
  const expected = 'a1234567-b123-4123-8123-c123456789ab'
  const cryptoApi = {
    randomUUID() { assert.equal(this, cryptoApi); return expected },
    getRandomValues() { assert.fail('No debe usar el segundo recurso') },
  }
  replaceGlobal(t, 'crypto', cryptoApi)
  assert.equal(generateId(), expected)
})

test('sin randomUUID genera UUID v4 con versión, variante y ceros correctos', (t) => {
  let fill = 0
  const cryptoApi = {
    getRandomValues(bytes) {
      assert.equal(this, cryptoApi)
      assert.equal(bytes.length, 16)
      return bytes.fill(fill)
    },
  }
  replaceGlobal(t, 'crypto', cryptoApi)
  assert.equal(generateId(), '00000000-0000-4000-8000-000000000000')
  fill = 255
  assert.equal(generateId(), 'ffffffff-ffff-4fff-bfff-ffffffffffff')
})

test('getRandomValues genera IDs distintos sin randomUUID', (t) => {
  replaceGlobal(t, 'crypto', cryptoWithoutUUID)
  const ids = Array.from({ length: 250 }, generateId)
  for (const id of ids) assert.match(id, uuidV4)
  assert.equal(new Set(ids).size, ids.length)
})

test('sin crypto evita colisiones incluso con reloj y aleatorio fijos', (t) => {
  replaceGlobal(t, 'crypto', undefined)
  t.mock.method(Date, 'now', () => 1700000000000)
  t.mock.method(Math, 'random', () => 0.5)
  const ids = Array.from({ length: 1000 }, generateId)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.match(id, /^loyw3v28-[0-9a-z]+-i-i$/)
})

test('propiedades crypto no invocables usan el último recurso', (t) => {
  replaceGlobal(t, 'crypto', { randomUUID: null, getRandomValues: 'no disponible' })
  const first = generateId()
  assert.equal(typeof first, 'string')
  assert.notEqual(generateId(), first)
})

test('sin structuredClone la copia JSON y la semilla conservan su independencia', (t) => {
  replaceGlobal(t, 'structuredClone', undefined)
  const original = { nested: [{ name: 'Daniel', optional: null, active: true }], timestamp: '2026-09-15T12:00:00.000Z' }
  const copy = cloneJsonData(original)
  assert.deepEqual(copy, original)
  copy.nested[0].name = 'Cambio'
  assert.equal(original.nested[0].name, 'Daniel')
  const seed = createDemoData()
  seed.contacts[0].vehicles[0].plates = 'CAMBIO'
  assert.equal(createDemoData().contacts[0].vehicles[0].plates, 'JKL-1234')
})

test('migrar sin structuredClone conserva valores y no modifica la base anterior', (t) => {
  replaceGlobal(t, 'structuredClone', undefined)
  const { accessRecords, ...seed } = createDemoData()
  const legacy = { ...seed, version: 5, session: { userId: 'user-daniel' } }
  const before = JSON.stringify(legacy)
  const migrated = migrateDemoData(legacy)
  assert.equal(migrated.version, 6)
  assert.deepEqual(migrated.accessRecords, [])
  assert.deepEqual(migrated.session, legacy.session)
  assert.deepEqual(migrated.contacts, legacy.contacts)
  migrated.contacts[0].vehicles[0].plates = 'CAMBIO'
  assert.equal(JSON.stringify(legacy), before)
})

for (const [label, cryptoApi] of [['sin randomUUID', cryptoWithoutUUID], ['sin crypto', undefined]]) {
  test(`altas e invitación con entrada/salida ${label} ni structuredClone`, async (t) => {
    replaceGlobal(t, 'crypto', cryptoApi)
    replaceGlobal(t, 'structuredClone', undefined)
    const storage = new Map()
    const windowMock = new EventTarget()
    windowMock.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
    replaceGlobal(t, 'window', windowMock)
    const login = (email) => authService.login({ email, password: DEMO_PASSWORD })

    await login('admin@accesshome.demo')
    const houseId = await communityService.createResidence({ number: '99', street: 'Robles', active: true })
    await communityService.assignPrincipal(houseId, { firstName: 'Prueba', lastName: 'Compatibilidad', email: 'compatibilidad@accesshome.demo' })
    assert.equal((await communityService.getResidence(houseId)).primaryResident.name, 'Prueba Compatibilidad')

    await login('residente@accesshome.demo')
    await communityService.createInhabitant('house-24', { firstName: 'Prueba', lastName: 'Habitante', phone: '', email: '', relationship: '', active: true })
    await communityService.createVehicle('house-24', { plates: 'COMP-240', brand: 'Mazda', model: '3', color: 'Azul', active: true, ownerId: null })
    const contactId = await contactsService.createContact({ name: 'Contacto compatible', phone: '', email: '', notes: '', active: true })
    await contactsService.createVehicle(contactId, { plates: 'COMP-241', brand: '', model: '', color: '', active: true })
    assert.equal((await contactsService.getContact(contactId)).vehicles.length, 1)

    const id = await invitationsService.createInvitation({
      source: 'occasional', visitorName: 'Visita compatible', phone: '',
      vehicle: { plates: 'COMP-242', brand: '', model: '', color: '' },
      saveAsContact: true, validity: { kind: '24hours' },
    })
    const invitation = await invitationsService.getInvitation(id)
    assert.equal(invitation.residenceId, 'house-24')
    assert.equal(invitation.usedUses, 0)
    assert.equal(invitation.maxUses, 2)
    assert.notEqual(invitation.id, invitation.token)
    const savedContact = await contactsService.getContact(invitation.contactId)
    assert.equal(savedContact.vehicles[0].plates, 'COMP-242')
    await contactsService.updateVehicle(savedContact.id, savedContact.vehicles[0].id, { ...savedContact.vehicles[0], plates: 'COMP-999' })
    assert.equal((await invitationsService.getInvitation(id)).vehicle.plates, 'COMP-242')

    await authService.logout()
    assert.equal((await publicInvitationService.getInvitation(invitation.token)).visitorName, 'Visita compatible')
    await login('admin@accesshome.demo')
    const entry = await accessService.validateToken(invitation.token)
    const exit = await accessService.validateToken(invitation.token)
    assert.equal(entry.authorized, true)
    assert.equal(entry.record.type, 'entrada')
    assert.equal(exit.authorized, true)
    assert.equal(exit.record.type, 'salida')
    assert.equal(exit.status, 'completada')
    assert.equal((await accessService.validateToken(invitation.token)).authorized, false)
    const data = JSON.parse(storage.get(DEMO_STORAGE_KEY))
    assert.equal(data.accessRecords.length, 2)
    const ids = [...data.users, ...data.residences, ...data.inhabitants, ...data.vehicles, ...data.contacts,
      ...data.contacts.flatMap((contact) => contact.vehicles), ...data.invitations, ...data.accessRecords].map((item) => item.id)
    assert.equal(new Set(ids).size, ids.length)
    assert.equal((await publicInvitationService.getInvitation(invitation.token)).usedUses, 2)
  })
}
