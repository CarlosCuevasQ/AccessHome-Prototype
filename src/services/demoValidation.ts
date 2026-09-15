import type { DemoDatabase } from '../types/demo.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasStrings(value: unknown, keys: string[]): value is Record<string, string> {
  return isRecord(value) && keys.every((key) => typeof value[key] === 'string' && value[key].trim() !== '')
}

export function isDemoDatabase(value: unknown): value is DemoDatabase {
  if (!isRecord(value) || value.version !== 1) return false
  const { users, condominiums, residences, vehicles, session } = value
  if (!Array.isArray(users) || !Array.isArray(condominiums) || !Array.isArray(residences) || !Array.isArray(vehicles)) return false
  if (!users.length || !condominiums.length) return false
  if (!condominiums.every((item) => hasStrings(item, ['id', 'name', 'address']))) return false
  if (!residences.every((item) => hasStrings(item, ['id', 'condominiumId', 'name', 'street']) && condominiums.some((condo) => condo.id === item.condominiumId))) return false
  if (!vehicles.every((item) => hasStrings(item, ['id', 'residenceId', 'plates', 'brand', 'model', 'color']) && residences.some((house) => house.id === item.residenceId))) return false
  if (!users.every((user: unknown) => {
    if (!hasStrings(user, ['id', 'name', 'email', 'password', 'role', 'condominiumId'])) return false
    if (!condominiums.some((condo) => condo.id === user.condominiumId)) return false
    if (user.role === 'admin') return user.residenceId === null
    return user.role === 'resident' && residences.some((house) => house.id === user.residenceId && house.condominiumId === user.condominiumId)
  })) return false
  if ([users, condominiums, residences, vehicles].some((items) => new Set(items.map((item) => item.id)).size !== items.length)) return false
  if (new Set(users.map((user) => user.email.toLowerCase())).size !== users.length) return false
  return session === null || (hasStrings(session, ['userId']) && users.some((user) => user.id === session.userId))
}
