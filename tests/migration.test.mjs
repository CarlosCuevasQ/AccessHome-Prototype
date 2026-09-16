import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { authService } from '../.test-build/services/authService.js'
import { communityService } from '../.test-build/services/communityService.js'
import { createDemoData } from '../.test-build/data/demo.js'
import { DEMO_STORAGE_KEY } from '../.test-build/services/demoStorage.js'

let storage
beforeEach(() => {
  storage = new Map()
  globalThis.window = new EventTarget()
  window.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
})

function versionTwo() {
  const { inhabitants, ...seed } = createDemoData()
  return {
    ...seed, version: 2,
    residences: seed.residences.map(({ active, principalUserId, ...house }) => house),
    vehicles: seed.vehicles.map((vehicle) => ({ ...vehicle, ownerId: inhabitants.find((person) => person.id === vehicle.ownerId)?.userId ?? null })),
    session: { userId: 'user-daniel' },
  }
}

function versionOne() {
  const seed = versionTwo()
  return {
    ...seed, version: 1, users: seed.users.slice(0, 2),
    condominiums: [{ id: 'condo-encinos', name: 'Residencial Los Encinos', address: 'Av. de los Encinos 120, Ciudad de México' }],
    residences: [
      { id: 'house-24', condominiumId: 'condo-encinos', name: 'Casa 24', street: 'Circuito Robles' },
      { id: 'house-25', condominiumId: 'condo-encinos', name: 'Casa 25', street: 'Circuito Robles' },
    ],
    vehicles: seed.vehicles.slice(0, 2).map(({ active, ownerId, ...vehicle }) => vehicle),
  }
}

test('migra v2 conservando casas y personas creadas, credenciales, propietarios y sesión', async () => {
  const old = versionTwo()
  old.residences.push({ id: 'house-custom', condominiumId: 'condo-encinos', number: '88', name: 'Casa 88', street: 'Circuito Cedros Norte' })
  old.users.push({ ...old.users[1], id: 'user-custom', name: 'Laura Méndez Ruiz', email: 'laura@accesshome.demo', password: 'Conservar123', residenceId: 'house-custom' })
  old.vehicles.push({ ...old.vehicles[0], id: 'vehicle-custom', plates: 'DEMO-088', residenceId: 'house-custom', ownerId: 'user-custom', active: false })
  old.condominiums[0].name = 'Nombre personalizado'
  old.users[1].name = 'Daniel editado'
  storage.set(DEMO_STORAGE_KEY, JSON.stringify(old))
  assert.equal((await authService.getSession()).name, 'Daniel editado')
  const migrated = JSON.parse(storage.get(DEMO_STORAGE_KEY))
  assert.equal(migrated.version, 7)
  assert.deepEqual(migrated.users, old.users)
  assert.deepEqual(migrated.session, old.session)
  assert.equal(migrated.residences.find((house) => house.id === 'house-custom').principalUserId, 'user-custom')
  assert.equal(migrated.vehicles.find((vehicle) => vehicle.id === 'vehicle-custom').ownerId, 'inhabitant-user-custom')
  assert.equal(migrated.vehicles.find((vehicle) => vehicle.id === 'vehicle-custom').active, false)
  assert.equal((await communityService.getResidence()).primaryResident.id, 'user-daniel')
  assert.equal((await communityService.getResidence()).inhabitants.length, 4)
  const once = storage.get(DEMO_STORAGE_KEY)
  await authService.getSession()
  assert.equal(storage.get(DEMO_STORAGE_KEY), once)
})

test('migra v1 hasta v7 conservando Casa 25, ediciones y relaciones', async () => {
  const old = versionOne()
  old.vehicles[0].color = 'Azul marino'
  storage.set(DEMO_STORAGE_KEY, JSON.stringify(old))
  const house = await communityService.getResidence()
  assert.equal(house.residence.number, '24')
  assert.equal(house.primaryResident.id, 'user-daniel')
  assert.equal(house.condominium.name, 'Residencial Los Robles')
  assert.equal(house.vehicles[0].color, 'Azul marino')
  assert.equal(house.vehicles[0].active, true)
  assert.equal(house.vehicles[0].ownerId, null)
  const migrated = JSON.parse(storage.get(DEMO_STORAGE_KEY))
  assert.equal(migrated.version, 7)
  assert.ok(migrated.residences.some((item) => item.id === 'house-25'))
  assert.ok(migrated.residences.some((item) => item.number === '51'))
})

test('migración fallida por almacenamiento no reemplaza la versión anterior', async () => {
  for (const old of [versionOne(), versionTwo()]) {
    storage.set(DEMO_STORAGE_KEY, JSON.stringify(old))
    const before = storage.get(DEMO_STORAGE_KEY)
    window.localStorage.setItem = () => { throw new Error('quota') }
    await assert.rejects(authService.getSession(), /No se pudieron guardar/)
    assert.equal(storage.get(DEMO_STORAGE_KEY), before)
  }
})

test('rechaza referencias inválidas de principal, propietario y cuentas de habitantes', async () => {
  for (const mutate of [
    (data) => { data.residences[0].principalUserId = 'user-daniel' },
    (data) => { data.vehicles[0].ownerId = 'inhabitant-user-ana' },
    (data) => { data.inhabitants[0].userId = 'user-admin' },
    (data) => { data.inhabitants.push(data.inhabitants[0]) },
    (data) => { data.residences[0].active = 'sí' },
  ]) {
    const data = createDemoData()
    mutate(data)
    storage.set(DEMO_STORAGE_KEY, JSON.stringify(data))
    await assert.rejects(authService.getSession(), /datos locales no son válidos/)
  }
})
