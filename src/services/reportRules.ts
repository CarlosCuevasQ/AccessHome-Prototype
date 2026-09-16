import type { DemoAccount, DemoDatabase } from '../types/demo.js'
import type { Report } from '../types/reports.js'
import { requireResidence, requireUser } from './communityRules.js'

export function reportContext(data: DemoDatabase) {
  const user = requireUser(data)
  const residence = user.role === 'resident' ? requireResidence(data, user, user.residenceId ?? '') : null
  return { user, residence, canCreate: !!residence?.active && residence.principalUserId === user.id }
}

export function visibleReports(data: DemoDatabase, user: DemoAccount): Report[] {
  return data.reports.filter((report) => report.condominiumId === user.condominiumId
    && (user.role === 'admin' || (report.authorUserId === user.id && report.residenceId === user.residenceId)))
}

export function requireReport(data: DemoDatabase, id: string): Report {
  const { user } = reportContext(data)
  const report = visibleReports(data, user).find((item) => item.id === id)
  if (!report) throw new Error('Reporte no disponible para tu cuenta.')
  return report
}
