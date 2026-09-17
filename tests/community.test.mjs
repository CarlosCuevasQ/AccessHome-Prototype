import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { authService } from '../.test-build/services/authService.js'
import { communityService as service } from '../.test-build/services/communityService.js'
import { demoService } from '../.test-build/services/demoService.js'
import { createDemoData } from '../.test-build/data/demo.js'
import { DEMO_STORAGE_KEY } from '../.test-build/services/demoStorage.js'

let storage
const admin = { email: 'admin@accesshome.demo', password: '' }
const resident = { email: 'residente@accesshome.demo', password: '' }
const vehicle = { plates: 'PRUEBA-88', brand: 'Honda', model: 'Civic', color: 'Negro', active: true, ownerId: null }
const inhabitant = { firstName: 'Lucía', lastName: 'Cuevas', phone: '', email: '', relationship: 'Familiar', active: true }
const houseInput = { number: '88', street: 'Circuito Cedros', active: true }
const current = () => JSON.parse(storage.get(DEMO_STORAGE_KEY))

beforeEach(async () => {
  storage = new Map()
  globalThis.window = new EventTarget()
  window.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  await authService.login(admin)
})

test('semilla coherente, Daniel principal de Casa 24 y habitantes sin cuenta', async () => {
  const summary = await service.getSummary()
  assert.equal(summary.condominium.name, 'Residencial Los Robles')
  assert.deepEqual([summary.residenceCount, summary.residentCount, summary.vehicleCount, summary.activeVehicleCount], [4, 8, 5, 4])
  const house = await service.getResidence('house-24')
  assert.equal(house.primaryResident.id, 'user-daniel')
  assert.equal('password' in house.primaryResident, false)
  assert.equal(house.inhabitants.length, 4)
  assert.equal(house.inhabitants.filter((person) => !person.userId).length, 2)
  assert.ok(house.vehicles.every((item) => !item.ownerId || house.inhabitants.some((person) => person.id === item.ownerId)))
  assert.deepEqual(house.permissions, { manageStructure: true, manageHousehold: false })
})

test('admin crea y asigna casa; principal entra y registra habitantes y vehículos persistentes', async () => {
  const id = await service.createResidence(houseInput)
  assert.equal((await service.getResidence(id)).primaryResident, null)
  await service.assignPrincipal(id, { firstName: 'Laura', lastName: 'Pérez', email: 'laura88@accesshome.demo' })
  await authService.logout()
  await authService.login({ email: 'laura88@accesshome.demo', password: '' })
  assert.equal((await service.getResidence()).residence.id, id)
  const accountCount = current().users.length
  await service.createInhabitant(id, inhabitant)
  const person = (await service.getResidence()).inhabitants.find((item) => item.firstName === 'Lucía')
  assert.equal(person.userId, null)
  assert.equal(current().users.length, accountCount)
  await service.createVehicle(id, { ...vehicle, ownerId: person.id })
  assert.equal((await service.getResidence()).vehicles[0].ownerId, person.id)
  assert.equal((await authService.getSession()).residenceId, id)
  await authService.login(admin)
  assert.equal((await service.getResidence(id)).inhabitants.length, 2)
  assert.equal((await service.getResidence(id)).vehicles.length, 1)
})

test('búsqueda, edición estructural y validación de número único', async () => {
  assert.equal((await service.listResidences('Casa 24'))[0].principalName, 'Daniel Cuevas')
  assert.equal((await service.listResidences('999')).length, 0)
  await assert.rejects(service.createResidence({ ...houseInput, number: '024' }), /Ya existe/)
  await assert.rejects(service.createResidence({ ...houseInput, number: '0' }), /número de casa/)
  await assert.rejects(service.createResidence({ ...houseInput, street: ' ' }), /Calle o circuito/)
  await service.updateResidence('house-24', { ...houseInput, number: '240' })
  await service.updateCondominium({ name: 'Los Robles Norte', address: 'Avenida 121' })
  const house = await service.getResidence('house-24')
  assert.equal(house.residence.name, 'Casa 240')
  assert.equal(house.residence.principalUserId, 'user-daniel')
  assert.equal(house.inhabitants.length, 4)
  assert.equal(house.condominium.name, 'Los Robles Norte')
})

test('admin no puede crear ni editar habitantes o vehículos mediante servicios', async () => {
  const before = storage.get(DEMO_STORAGE_KEY)
  for (const call of [
    () => service.createInhabitant('house-24', inhabitant),
    () => service.updateInhabitant('house-24', 'inhabitant-carlos', inhabitant),
    () => service.createVehicle('house-24', vehicle),
    () => service.updateVehicle('house-24', 'vehicle-1', vehicle),
  ]) await assert.rejects(call(), /Solo el residente principal/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
})

test('principal edita contacto sin cambiar credenciales, casa ni rol', async () => {
  await authService.login(resident)
  await service.updateInhabitant('house-24', 'inhabitant-user-daniel', { ...inhabitant, firstName: 'Daniel', lastName: 'Cuevas López', email: 'contacto@accesshome.demo', userId: 'user-admin', residenceId: 'house-12', role: 'admin' })
  const user = await authService.getSession()
  assert.equal(user.name, 'Daniel Cuevas López')
  assert.equal(user.email, resident.email)
  assert.equal(user.role, 'resident')
  assert.equal(user.residenceId, 'house-24')
  assert.equal((await service.getResidence()).primaryResident.id, user.id)
  await authService.logout()
  assert.equal((await authService.login(resident)).id, 'user-daniel')
})

test('desactiva y reactiva habitantes, preservando propietarios; protege al principal', async () => {
  await authService.login(resident)
  const house = await service.getResidence()
  const person = house.inhabitants.find((item) => item.userId === 'user-mariana')
  await service.updateInhabitant('house-24', person.id, { ...person, active: false })
  assert.equal((await service.getResidence()).vehicles[1].ownerId, person.id)
  await assert.rejects(service.updateInhabitant('house-24', 'inhabitant-user-daniel', { ...inhabitant, active: false }), /asignar otro residente principal/)
  await assert.rejects(authService.login({ email: 'mariana@accesshome.demo', password: '' }), /inactivo/)
  await service.updateInhabitant('house-24', person.id, { ...person, active: true })
  await authService.login({ email: 'mariana@accesshome.demo', password: '' })
  assert.equal((await service.getResidence()).permissions.manageHousehold, false)
  await assert.rejects(service.createInhabitant('house-24', inhabitant), /Solo el residente principal/)
})

test('principal edita, desactiva y reactiva vehículos, con propietario opcional', async () => {
  await authService.login(resident)
  await service.updateVehicle('house-24', 'vehicle-1', { ...vehicle, active: false, residenceId: 'house-12' })
  const updated = (await service.getResidence()).vehicles.find((item) => item.id === 'vehicle-1')
  assert.equal(updated.residenceId, 'house-24')
  assert.equal(updated.plates, vehicle.plates)
  assert.equal(updated.active, false)
  assert.equal(updated.ownerId, null)
  await service.updateVehicle('house-24', updated.id, { ...updated, active: true })
  assert.equal((await service.getResidence()).vehicles[0].active, true)
})

test('placas normalizadas únicas y propietarios pertenecientes a la casa', async () => {
  await authService.login(resident)
  const before = storage.get(DEMO_STORAGE_KEY)
  await assert.rejects(service.createVehicle('house-24', { ...vehicle, plates: 'demo 012' }), /placas ya están/)
  await assert.rejects(service.createVehicle('house-24', { ...vehicle, ownerId: 'inhabitant-user-ana' }), /propietario principal/)
  await assert.rejects(service.updateVehicle('house-24', 'vehicle-1', { ...vehicle, ownerId: 'user-admin' }), /propietario principal/)
  await assert.rejects(service.createVehicle('house-24', { ...vehicle, model: ' ' }), /Modelo/)
  await assert.rejects(service.createInhabitant('house-24', { ...inhabitant, email: 'inválido' }), /correo electrónico válido/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
})

test('principal no modifica estructura, asignación ni consulta otras residencias', async () => {
  await authService.login(resident)
  const before = storage.get(DEMO_STORAGE_KEY)
  for (const call of [
    () => service.createResidence(houseInput),
    () => service.updateResidence('house-24', houseInput),
    () => service.updateCondominium({ name: 'Otro', address: 'Otra' }),
    () => service.assignPrincipal('house-12', { inhabitantId: 'inhabitant-user-daniel' }),
    () => service.listResidences(),
  ]) await assert.rejects(call(), /Solo el administrador/)
  await assert.rejects(service.getResidence('house-12'), /propia residencia/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
})

test('todas las mutaciones cotidianas rechazan otra casa o IDs ajenos sin escribir', async () => {
  await authService.login(resident)
  const before = storage.get(DEMO_STORAGE_KEY)
  for (const call of [
    () => service.createInhabitant('house-12', inhabitant),
    () => service.updateInhabitant('house-12', 'inhabitant-user-ana', inhabitant),
    () => service.createVehicle('house-12', vehicle),
    () => service.updateVehicle('house-12', 'vehicle-12', vehicle),
  ]) await assert.rejects(call(), /propia residencia/)
  await assert.rejects(service.updateInhabitant('house-24', 'inhabitant-user-ana', inhabitant), /No se encontró/)
  await assert.rejects(service.updateVehicle('house-24', 'vehicle-12', vehicle), /No se encontró/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
})

test('cambio de principal reutiliza cuenta y revoca permisos anteriores inmediatamente', async () => {
  const usersBefore = current().users.length
  await service.assignPrincipal('house-24', { inhabitantId: 'inhabitant-user-mariana' })
  assert.equal(current().users.length, usersBefore)
  await authService.login(resident)
  assert.equal((await service.getResidence()).permissions.manageHousehold, false)
  await assert.rejects(service.createVehicle('house-24', vehicle), /Solo el residente principal/)
  await authService.login({ email: 'mariana@accesshome.demo', password: '' })
  await service.createVehicle('house-24', vehicle)
  assert.equal((await service.getResidence()).vehicles.length, 3)
})

test('asignar habitante sin cuenta crea solo su cuenta, sin duplicar ni moverlo', async () => {
  const peopleBefore = current().inhabitants.length
  await service.assignPrincipal('house-24', { inhabitantId: 'inhabitant-andrea', loginEmail: 'andrea@accesshome.demo' })
  assert.equal(current().inhabitants.length, peopleBefore)
  await authService.login({ email: 'andrea@accesshome.demo', password: '' })
  assert.equal((await service.getResidence()).permissions.manageHousehold, true)
  assert.equal((await authService.getSession()).residenceId, 'house-24')
})

test('asignaciones inválidas no duplican cuentas ni trasladan habitantes entre casas', async () => {
  const before = storage.get(DEMO_STORAGE_KEY)
  await assert.rejects(service.assignPrincipal('house-12', { inhabitantId: 'inhabitant-user-daniel' }), /habitante activo de esta residencia/)
  await assert.rejects(service.assignPrincipal('house-12', { firstName: 'Daniel', lastName: 'Cuevas', email: resident.email }), /correo ya tiene una cuenta/)
  await assert.rejects(service.assignPrincipal('house-24', { inhabitantId: 'inhabitant-andrea', loginEmail: 'invalido' }), /correo electrónico válido/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
})

test('casa inactiva permite consulta y bloquea gestión hasta reactivación administrativa', async () => {
  await service.updateResidence('house-24', { number: '24', street: 'Circuito Robles', active: false })
  await authService.login(resident)
  assert.equal((await service.getResidence()).permissions.manageHousehold, false)
  for (const call of [
    () => service.createInhabitant('house-24', inhabitant),
    () => service.updateInhabitant('house-24', 'inhabitant-carlos', inhabitant),
    () => service.createVehicle('house-24', vehicle),
    () => service.updateVehicle('house-24', 'vehicle-1', vehicle),
  ]) await assert.rejects(call(), /residencia está inactiva/)
  await authService.login(admin)
  await service.updateResidence('house-24', { number: '24', street: 'Circuito Robles', active: true })
  await authService.login(resident)
  await service.createVehicle('house-24', vehicle)
})

test('sin sesión o con cuenta desactivada no se consulta ni modifica la comunidad', async () => {
  await authService.logout()
  await assert.rejects(service.getResidence('house-24'), /Inicia sesión/)
  await assert.rejects(service.createVehicle('house-24', vehicle), /Inicia sesión/)
  const data = current()
  data.session = { userId: 'user-mariana' }
  data.inhabitants.find((person) => person.userId === 'user-mariana').active = false
  storage.set(DEMO_STORAGE_KEY, JSON.stringify(data))
  assert.equal(await authService.getSession(), null)
  await assert.rejects(service.getResidence(), /Inicia sesión/)
})

test('administrador tampoco consulta o modifica residencias de otro condominio', async () => {
  const data = current()
  data.condominiums.push({ id: 'other', name: 'Otro', address: 'Otra dirección' })
  data.residences.push({ ...houseInput, id: 'other-house', condominiumId: 'other', name: 'Casa 88', principalUserId: null })
  storage.set(DEMO_STORAGE_KEY, JSON.stringify(data))
  await assert.rejects(service.getResidence('other-house'), /tu condominio/)
  await assert.rejects(service.updateResidence('other-house', houseInput), /tu condominio/)
  await assert.rejects(service.assignPrincipal('other-house', { firstName: 'Otra', lastName: 'Persona', email: 'otra@accesshome.demo' }), /tu condominio/)
})

test('fallo de escritura no anuncia éxito y restaurar recupera toda la semilla', async () => {
  const originalWrite = window.localStorage.setItem
  const before = storage.get(DEMO_STORAGE_KEY)
  window.localStorage.setItem = () => { throw new Error('quota') }
  await assert.rejects(service.assignPrincipal('house-24', { inhabitantId: 'inhabitant-carlos', loginEmail: 'carlos@accesshome.demo' }), /No se pudieron guardar/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), before)
  window.localStorage.setItem = originalWrite
  await service.createResidence(houseInput)
  await authService.login(resident)
  await service.createInhabitant('house-24', inhabitant)
  await service.updateVehicle('house-24', 'vehicle-1', { ...vehicle, active: false })
  await demoService.resetDemoData()
  assert.deepEqual(current(), createDemoData())
  assert.equal(await authService.getSession(), null)
})

