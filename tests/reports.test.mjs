import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { authService } from '../.test-build/services/authService.js'
import { reportsService as reports } from '../.test-build/services/reportsService.js'
import { communityService } from '../.test-build/services/communityService.js'
import { invitationsService } from '../.test-build/services/invitationsService.js'
import { accessService } from '../.test-build/services/accessService.js'
import { demoService } from '../.test-build/services/demoService.js'
import { createDemoData, DEMO_PASSWORD } from '../.test-build/data/demo.js'
import { DEMO_STORAGE_KEY } from '../.test-build/services/demoStorage.js'

let storage
const login = (email) => authService.login({ email, password: DEMO_PASSWORD })
const read = () => JSON.parse(storage.get(DEMO_STORAGE_KEY))
const write = (data) => storage.set(DEMO_STORAGE_KEY, JSON.stringify(data))
const input = { title: 'Lámpara apagada', category: 'Instalaciones', description: 'La lámpara junto a Casa 24 no enciende por la noche.' }
beforeEach(async () => {
  storage = new Map()
  globalThis.window = new EventTarget()
  window.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  await login('residente@accesshome.demo')
})

test('reporte fija autor, casa, fechas y pendiente; persiste tras logout', async () => {
  const id = await reports.createReport({ ...input, title: '  Lámpara apagada  ', authorUserId: 'user-ana', status: 'completado', condominiumId: 'otro' })
  const report = await reports.getReport(id)
  assert.equal(report.title, input.title)
  assert.equal(report.authorUserId, 'user-daniel')
  assert.equal(report.residenceId, 'house-24')
  assert.equal(report.condominiumId, 'condo-encinos')
  assert.equal(report.status, 'pendiente')
  assert.equal(report.createdAt, report.updatedAt)
  await authService.logout()
  await login('residente@accesshome.demo')
  assert.deepEqual(await reports.getReport(id), report)
})

test('rechaza campos inválidos, categoría desconocida y residencia ajena sin guardar', async () => {
  const before = storage.get(DEMO_STORAGE_KEY)
  for (const invalid of [{ title: ' ' }, { title: 'x'.repeat(121) }, { description: '' }, { description: 'x'.repeat(3001) }, { category: 'Inventada' }, { residenceId: 'house-12' }]) {
    await assert.rejects(reports.createReport({ ...input, ...invalid }))
    assert.equal(storage.get(DEMO_STORAGE_KEY), before)
  }
})

test('reportes privados por autor incluso entre cuentas de la misma casa', async () => {
  const id = await reports.createReport(input)
  for (const email of ['ana@accesshome.demo', 'mariana@accesshome.demo']) {
    await login(email)
    assert.deepEqual(await reports.listReports(), [])
    await assert.rejects(reports.getReport(id), /no disponible/)
    await assert.rejects(reports.updateStatus(id, 'en_proceso'), /administrador/)
  }
  await login('admin@accesshome.demo')
  assert.equal((await reports.listReports()).length, 1)
  assert.equal((await reports.getReport(id)).authorName, 'Daniel Cuevas')
})

test('admin avanza pendiente a en proceso a completado; no salta, retrocede ni reabre', async () => {
  const id = await reports.createReport(input)
  await login('admin@accesshome.demo')
  await assert.rejects(reports.updateStatus(id, 'completado'), /solo puede avanzar/)
  await reports.updateStatus(id, 'en_proceso')
  await assert.rejects(reports.updateStatus(id, 'pendiente'), /solo puede avanzar/)
  await reports.updateStatus(id, 'completado')
  const report = await reports.getReport(id)
  assert.equal(report.status, 'completado')
  assert.ok(Date.parse(report.updatedAt) >= Date.parse(report.createdAt))
  await assert.rejects(reports.updateStatus(id, 'en_proceso'), /solo puede avanzar/)
  await assert.rejects(reports.updateStatus(id, null), /solo puede avanzar/)
  await login('residente@accesshome.demo')
  assert.equal((await reports.getReport(id)).status, 'completado')
})

test('creación respeta principal, cuenta activa y casa activa; consultas conservadas', async () => {
  const id = await reports.createReport(input)
  await login('mariana@accesshome.demo')
  assert.equal((await reports.getContext()).canCreate, false)
  await assert.rejects(reports.createReport(input), /principal/)
  await login('admin@accesshome.demo')
  await assert.rejects(reports.createReport(input), /residente/)
  await communityService.updateResidence('house-24', { number: '24', street: 'Robles', active: false })
  await login('residente@accesshome.demo')
  await assert.rejects(reports.createReport(input), /inactiva/)
  assert.equal((await reports.getReport(id)).id, id)
  await authService.logout()
  for (const action of [() => reports.getContext(), () => reports.listReports(), () => reports.getReport(id), () => reports.createReport(input), () => reports.updateStatus(id, 'en_proceso')]) await assert.rejects(action(), /Inicia sesión/)
})

test('admin de otro condominio no lista, consulta ni cambia reportes ajenos', async () => {
  const id = await reports.createReport(input)
  const data = read()
  data.condominiums.push({ id: 'other', name: 'Otro condominio', address: 'Otra calle' })
  data.users.push({ ...data.users[0], id: 'other-admin', email: 'otro@accesshome.demo', condominiumId: 'other' })
  write(data)
  await login('otro@accesshome.demo')
  assert.deepEqual(await reports.listReports(), [])
  await assert.rejects(reports.getReport(id), /no disponible/)
  await assert.rejects(reports.updateStatus(id, 'en_proceso'), /no disponible/)
})

test('fallos de escritura no crean reportes ni anuncian cambios de estado', async () => {
  const id = await reports.createReport(input)
  const writeOriginal = window.localStorage.setItem
  window.localStorage.setItem = () => { throw new Error('quota') }
  await assert.rejects(reports.createReport(input), /guardar/)
  assert.equal(read().reports.length, 1)
  window.localStorage.setItem = writeOriginal
  await login('admin@accesshome.demo')
  window.localStorage.setItem = () => { throw new Error('quota') }
  await assert.rejects(reports.updateStatus(id, 'en_proceso'), /guardar/)
  assert.equal(read().reports[0].status, 'pendiente')
})

test('migración v6 conserva todos los datos y sesión; reset incluye reportes', async () => {
  const invitationId = await invitationsService.createInvitation({ source: 'occasional', visitorName: 'Visita conservada', phone: '', vehicle: null, saveAsContact: false, validity: { kind: '24hours' } })
  const invitation = await invitationsService.getInvitation(invitationId)
  await login('admin@accesshome.demo')
  await accessService.validateToken(invitation.token)
  await login('residente@accesshome.demo')
  const { reports: unused, ...old } = read()
  old.version = 6
  old.condominiums[0].name = 'Conservar este nombre'
  write(old)
  assert.deepEqual(await reports.listReports(), [])
  assert.deepEqual(read(), { ...old, version: 7, reports: [] })
  const once = storage.get(DEMO_STORAGE_KEY)
  await reports.getContext()
  assert.equal(storage.get(DEMO_STORAGE_KEY), once)
  await reports.createReport(input)
  await demoService.resetDemoData()
  assert.deepEqual(read(), createDemoData())
})

test('reportes corruptos se rechazan sin sobrescribir datos', async () => {
  await reports.createReport(input)
  const original = read()
  for (const corrupt of [
    (data) => { data.reports[0].status = 'desconocido' },
    (data) => { data.reports[0].authorUserId = 'user-admin' },
    (data) => { data.reports[0].residenceId = 'house-12' },
    (data) => { data.reports[0].updatedAt = 'invalid' },
    (data) => { data.reports.push(data.reports[0]) },
  ]) {
    const data = JSON.parse(JSON.stringify(original))
    corrupt(data); write(data)
    const before = storage.get(DEMO_STORAGE_KEY)
    await assert.rejects(reports.listReports(), /no son válidos/)
    assert.equal(storage.get(DEMO_STORAGE_KEY), before)
  }
})
