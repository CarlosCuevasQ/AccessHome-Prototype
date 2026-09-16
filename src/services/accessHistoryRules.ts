import type { DemoAccount, DemoDatabase } from '../types/demo.js'
import type { AccessHistoryFilters, AccessRecord } from '../types/access.js'
import { requireResidence } from './communityRules.js'

export function historyResidences(data: DemoDatabase, user: DemoAccount) {
  if (user.role === 'resident') return [requireResidence(data, user, user.residenceId ?? '')]
  return data.residences.filter((house) => house.condominiumId === user.condominiumId)
}

export function visibleAccessRecords(data: DemoDatabase, user: DemoAccount): AccessRecord[] {
  const ids = new Set(historyResidences(data, user).map((house) => house.id))
  return data.accessRecords.filter((record) => ids.has(record.residenceId))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

function dateBoundary(value: string, end = false): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Selecciona una fecha válida.')
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new Error('Selecciona una fecha válida.')
  if (end) date.setDate(date.getDate() + 1)
  return date.getTime()
}

export function filterAccessRecords(records: AccessRecord[], filters: AccessHistoryFilters): AccessRecord[] {
  if (filters.type && !['entrada', 'salida'].includes(filters.type)) throw new Error('Selecciona entrada o salida.')
  const from = filters.from ? dateBoundary(filters.from) : -Infinity
  const to = filters.to ? dateBoundary(filters.to, true) : Infinity
  if (from >= to) throw new Error('La fecha final debe ser igual o posterior a la inicial.')
  const key = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()
  const query = key(filters.search ?? '')
  return records.filter((record) => (!filters.residenceId || record.residenceId === filters.residenceId)
    && (!filters.type || record.type === filters.type)
    && Date.parse(record.occurredAt) >= from && Date.parse(record.occurredAt) < to
    && key(`${record.visitorName} ${record.residenceName} ${record.inviterName} ${record.vehicle?.plates ?? ''}`).includes(query))
}
