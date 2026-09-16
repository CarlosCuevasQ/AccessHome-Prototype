import type { DemoAccount, Residence } from '../types/demo.js'

export function validStoredInvitations(value: unknown, users: DemoAccount[], residences: Residence[]): boolean {
  if (!Array.isArray(value)) return false
  const tokens = new Set<string>()
  const ids = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object'
      || !['id', 'token', 'inviterUserId', 'inviterName', 'residenceId', 'residenceName', 'visitorName'].every((key) => typeof item[key] === 'string' && item[key].trim())
      || typeof item.phone !== 'string'
      || !(item.contactId === null || (typeof item.contactId === 'string' && item.contactId.trim()))
      || !['startsAt', 'expiresAt', 'createdAt'].every((key) => typeof item[key] === 'string' && Number.isFinite(Date.parse(item[key])))
      || Date.parse(item.expiresAt) <= Date.parse(item.startsAt)
      || !Number.isInteger(item.maxUses) || item.maxUses < 1
      || !Number.isInteger(item.usedUses) || item.usedUses < 0 || item.usedUses > item.maxUses
      || !['activa', 'completada', 'cancelada', 'expirada'].includes(item.status)
      || (item.status === 'completada' && item.usedUses !== item.maxUses)
      || !users.some((user) => user.id === item.inviterUserId && user.role === 'resident')
      || !residences.some((house) => house.id === item.residenceId)
      || ids.has(item.id) || tokens.has(item.token)) return false
    if (item.vehicle !== null && (!item.vehicle || typeof item.vehicle !== 'object'
      || typeof item.vehicle.plates !== 'string' || !item.vehicle.plates.trim()
      || !['brand', 'model', 'color'].every((key) => typeof item.vehicle[key] === 'string'))) return false
    ids.add(item.id)
    tokens.add(item.token)
  }
  return true
}
