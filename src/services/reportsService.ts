import { sharedMode } from './shared/provider.js'
import { sharedReports } from './shared/adapters.js'
import { reportCategories } from '../types/reports.js'
import type { ReportInput, ReportStatus } from '../types/reports.js'
import { generateId } from '../utils/id.js'
import { readDemoData, saveDemoData } from './demoStorage.js'
import { requireHouseholdManager, requiredText } from './communityRules.js'
import { reportContext, requireReport, visibleReports } from './reportRules.js'

const localService = {
  async getContext() {
    const { user, residence, canCreate } = reportContext(readDemoData())
    return { administrative: user.role === 'admin', residenceName: residence?.name, canCreate }
  },
  async listReports() {
    const data = readDemoData()
    return visibleReports(data, reportContext(data).user).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
  async getReport(id: string) { return requireReport(readDemoData(), id) },
  async createReport(input: ReportInput): Promise<string> {
    const data = readDemoData()
    const { user, residence } = reportContext(data)
    if (!residence) throw new Error('Solo un residente puede crear reportes.')
    requireHouseholdManager(data, residence.id)
    if ('residenceId' in input && input.residenceId !== residence.id) throw new Error('Solo puedes reportar desde tu propia residencia.')
    if (!reportCategories.includes(input.category)) throw new Error('Selecciona una categoría válida.')
    const title = requiredText(input.title, 'Título', 120)
    const description = requiredText(input.description, 'Descripción', 3000)
    const id = generateId()
    const now = new Date(Date.now()).toISOString()
    data.reports.push({ id, condominiumId: user.condominiumId, residenceId: residence.id, residenceName: residence.name,
      authorUserId: user.id, authorName: user.name, title, category: input.category, description,
      status: 'pendiente', createdAt: now, updatedAt: now })
    saveDemoData(data)
    return id
  },
  async updateStatus(id: string, status: ReportStatus): Promise<void> {
    const data = readDemoData()
    if (reportContext(data).user.role !== 'admin') throw new Error('Solo el administrador puede cambiar el estado de un reporte.')
    const report = requireReport(data, id)
    const next = report.status === 'pendiente' ? 'en_proceso' : report.status === 'en_proceso' ? 'completado' : null
    if (!next || status !== next) throw new Error('El reporte solo puede avanzar de pendiente a en proceso y después a completado.')
    report.status = status
    report.updatedAt = new Date(Date.now()).toISOString()
    saveDemoData(data)
  },
}

export const reportsService = sharedMode ? sharedReports : localService
