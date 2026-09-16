import type { DemoAccount, Residence } from '../types/demo.js'
import { reportCategories, reportStatusLabels } from '../types/reports.js'

export function validStoredReports(value: unknown, users: DemoAccount[], residences: Residence[]): boolean {
  if (!Array.isArray(value)) return false
  const ids = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object'
      || !['id', 'condominiumId', 'residenceId', 'residenceName', 'authorUserId', 'authorName', 'title', 'description'].every((key) => typeof item[key] === 'string' && item[key].trim())
      || item.title.length > 120 || item.description.length > 3000
      || !reportCategories.includes(item.category) || !Object.keys(reportStatusLabels).includes(item.status)
      || !['createdAt', 'updatedAt'].every((key) => typeof item[key] === 'string' && Number.isFinite(Date.parse(item[key])))
      || Date.parse(item.updatedAt) < Date.parse(item.createdAt) || ids.has(item.id)
      || !residences.some((house) => house.id === item.residenceId && house.condominiumId === item.condominiumId)
      || !users.some((user) => user.id === item.authorUserId && user.role === 'resident' && user.residenceId === item.residenceId && user.condominiumId === item.condominiumId)) return false
    ids.add(item.id)
  }
  return true
}
