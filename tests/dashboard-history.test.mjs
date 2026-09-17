import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { authService } from '../.test-build/services/authService.js'
import { invitationsService as invitations } from '../.test-build/services/invitationsService.js'
import { accessService as access } from '../.test-build/services/accessService.js'
import { accessHistoryService as history } from '../.test-build/services/accessHistoryService.js'
import { dashboardService as dashboard } from '../.test-build/services/dashboardService.js'
import { reportsService as reports } from '../.test-build/services/reportsService.js'
import { createDemoData } from '../.test-build/data/demo.js'
import { DEMO_STORAGE_KEY } from '../.test-build/services/demoStorage.js'
import { localDateInput } from '../.test-build/utils/dates.js'

let storage
const login = (email) => authService.login({ email, password: '' })
const read = () => JSON.parse(storage.get(DEMO_STORAGE_KEY))
const write = (data) => storage.set(DEMO_STORAGE_KEY, JSON.stringify(data))
async function visit(email, name) {
  await login(email)
  return invitations.getInvitation(await invitations.createInvitation({ source: 'occasional', visitorName: name, phone: '', vehicle: { plates: 'HIS-124', brand: '', model: '', color: '' }, saveAsContact: false, validity: { kind: '24hours' } }))
}
beforeEach(async () => {
  storage = new Map()
  globalThis.window = new EventTarget()
  window.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  await login('residente@accesshome.demo')
})

test('historial admin incluye ambas casas; residente y cuenta adicional solo su casa', async () => {
  const daniel = await visit('residente@accesshome.demo', 'Lucía visita 24')
  const ana = await visit('ana@accesshome.demo', 'Visita 12')
  await login('admin@accesshome.demo')
  await access.validateToken(daniel.token); await access.validateToken(daniel.token); await access.validateToken(ana.token)
  assert.equal((await history.listRecords()).length, 3)
  assert.equal((await history.listRecords({ residenceId: 'house-24' })).length, 2)
  assert.equal((await history.listRecords({ search: 'lucia', type: 'salida' })).length, 1)
  assert.equal((await history.listRecords({ search: 'HIS-124' })).length, 3)
  for (const email of ['residente@accesshome.demo', 'mariana@accesshome.demo']) {
    await login(email)
    assert.deepEqual((await history.getContext()).residences, [{ id: 'house-24', name: 'Casa 24' }])
    assert.equal((await history.listRecords()).length, 2)
    assert.deepEqual(await history.listRecords({ search: 'Visita 12' }), [])
    await assert.rejects(history.listRecords({ residenceId: 'house-12' }), /otra residencia/)
  }
  await login('ana@accesshome.demo')
  assert.equal((await history.listRecords()).length, 1)
})

test('fechas inclusivas por día local, medianoche y filtros inválidos', async (t) => {
  const invitation = await visit('residente@accesshome.demo', 'Fechas')
  await login('admin@accesshome.demo')
  await access.validateToken(invitation.token); await access.validateToken(invitation.token)
  const data = read()
  data.accessRecords[0].occurredAt = new Date(2026, 8, 15, 0, 0).toISOString()
  data.accessRecords[1].occurredAt = new Date(2026, 8, 16, 0, 0).toISOString()
  write(data)
  assert.equal((await history.listRecords({ from: '2026-09-15', to: '2026-09-15' })).length, 1)
  assert.equal((await history.listRecords({ from: '2026-09-15', to: '2026-09-16' })).length, 2)
  for (const filters of [{ from: '2026-02-30' }, { to: 'bad' }, { from: '2026-09-16', to: '2026-09-15' }, { type: 'otro' }]) await assert.rejects(history.listRecords(filters))
  t.mock.method(Date, 'now', () => new Date(2026, 8, 15, 12).getTime())
  assert.equal((await dashboard.getAdminDashboard()).todayAccessCount, 1)
})

test('dashboards usan registros reales, expiración y estados; excluyen agenda de vehículos', async (t) => {
  const now = Date.now()
  t.mock.method(Date, 'now', () => now)
  const initial = await dashboard.getResidentDashboard()
  assert.equal(initial.vehicleCount, 2)
  assert.equal(initial.inhabitantCount, 4)
  const invitation = await visit('residente@accesshome.demo', 'Resumen')
  const reportId = await reports.createReport({ title: 'Portón', category: 'Acceso', description: 'Revisar apertura.' })
  assert.equal((await dashboard.getResidentDashboard()).pendingReportCount, 1)
  assert.equal((await dashboard.getResidentDashboard()).activeInvitationCount, 1)
  await login('admin@accesshome.demo')
  const admin = await dashboard.getAdminDashboard()
  assert.equal(admin.residenceCount, 4)
  assert.equal(admin.activeInhabitantCount, read().inhabitants.filter((item) => item.active).length)
  assert.equal(admin.vehicleCount, 5)
  assert.equal(admin.pendingReportCount, 1)
  await access.validateToken(invitation.token)
  await access.validateToken(invitation.token)
  await reports.updateStatus(reportId, 'en_proceso')
  const after = await dashboard.getAdminDashboard()
  assert.equal(after.todayAccessCount, 2)
  assert.equal(after.activeInvitationCount, 0)
  assert.equal(after.pendingReportCount, 0)
  await login('residente@accesshome.demo')
  assert.equal((await dashboard.getResidentDashboard()).recentVisitCount, 1)
  assert.equal((await dashboard.getResidentDashboard()).recentAccess.length, 2)
  const expiring = await visit('residente@accesshome.demo', 'Expira')
  t.mock.method(Date, 'now', () => Date.parse(expiring.expiresAt))
  assert.equal((await dashboard.getResidentDashboard()).activeInvitationCount, 0)
})

test('resumen residente excluye otras casas y reportes de otro autor de su casa', async () => {
  const danielReport = await reports.createReport({ title: 'Daniel', category: 'Otro', description: 'Solo Daniel.' })
  const invitation = await visit('ana@accesshome.demo', 'Visita de Ana')
  await reports.createReport({ title: 'Ana', category: 'Otro', description: 'Solo Ana.' })
  await login('admin@accesshome.demo')
  await access.validateToken(invitation.token)
  await login('residente@accesshome.demo')
  const summary = await dashboard.getResidentDashboard()
  assert.equal(summary.pendingReportCount, 1)
  assert.equal(summary.activeInvitationCount, 0)
  assert.equal(summary.recentVisitCount, 0)
  assert.deepEqual(summary.recentAccess, [])
  assert.equal((await reports.getReport(danielReport)).title, 'Daniel')
  await login('mariana@accesshome.demo')
  assert.equal((await dashboard.getResidentDashboard()).pendingReportCount, 0)
  assert.equal((await dashboard.getResidentDashboard()).canManage, false)
})

test('historial y dashboards rechazan sesión anónima y roles incorrectos', async () => {
  await assert.rejects(dashboard.getAdminDashboard())
  await login('admin@accesshome.demo')
  await assert.rejects(dashboard.getResidentDashboard())
  await authService.logout()
  for (const action of [() => history.getContext(), () => history.listRecords(), () => dashboard.getAdminDashboard(), () => dashboard.getResidentDashboard()]) await assert.rejects(action(), /Inicia sesión/)
})

test('actividad reciente limita a cinco movimientos y visitas recientes a siete días', async (t) => {
  const now = new Date(2026, 8, 15, 12).getTime()
  t.mock.method(Date, 'now', () => now)
  for (let i = 0; i < 4; i++) {
    const invitation = await visit('residente@accesshome.demo', `Visita ${i}`)
    await login('admin@accesshome.demo')
    await access.validateToken(invitation.token); await access.validateToken(invitation.token)
  }
  const data = read()
  data.accessRecords[0].occurredAt = new Date(2026, 8, 8, 23, 59).toISOString()
  data.accessRecords[1].occurredAt = new Date(2026, 8, 9, 0, 0).toISOString()
  write(data)
  await login('residente@accesshome.demo')
  assert.equal((await dashboard.getResidentDashboard()).recentAccess.length, 5)
  assert.equal((await dashboard.getResidentDashboard()).recentVisitCount, 3)
  assert.equal((await history.listRecords({ from: localDateInput(new Date(now)).slice(0, 10) })).length, 6)
})

test('otro condominio no filtra ni incorpora datos ajenos en su dashboard', async () => {
  const invitation = await visit('residente@accesshome.demo', 'Privado')
  await login('admin@accesshome.demo'); await access.validateToken(invitation.token)
  const data = read()
  data.condominiums.push({ id: 'other', name: 'Otro', address: 'Otra calle' })
  data.users.push({ ...data.users[0], id: 'other-admin', email: 'otro@accesshome.demo', condominiumId: 'other' })
  write(data); await login('otro@accesshome.demo')
  assert.deepEqual((await history.getContext()).residences, [])
  assert.deepEqual(await history.listRecords(), [])
  await assert.rejects(history.listRecords({ residenceId: 'house-24' }))
  const summary = await dashboard.getAdminDashboard()
  for (const key of ['residenceCount', 'activeInhabitantCount', 'vehicleCount', 'todayAccessCount', 'activeInvitationCount', 'pendingReportCount']) assert.equal(summary[key], 0)
  assert.deepEqual(summary.recentAccess, [])
})

