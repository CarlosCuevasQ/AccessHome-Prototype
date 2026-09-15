import type { DemoDatabase, DemoDatabaseV2, DemoDatabaseV3, LegacyDemoDatabase } from '../types/demo.js'
import { validStoredContacts } from './contactValidation.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasStrings(value: unknown, keys: string[]): value is Record<string, string> {
  return isRecord(value) && keys.every((key) => typeof value[key] === 'string' && value[key].trim() !== '')
}

function isDatabase(value: unknown, version: 1 | 2 | 3 | 4): boolean {
  if (!isRecord(value) || value.version !== version) return false
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
  if (version >= 2) {
    if (!residences.every((house) => typeof house.number === 'string' && /^[1-9]\d{0,4}$/.test(house.number))) return false
    if (new Set(residences.map((house) => `${house.condominiumId}:${house.number}`)).size !== residences.length) return false
    if (!vehicles.every((vehicle) => typeof vehicle.active === 'boolean')) return false
    if (version === 2 && !vehicles.every((vehicle) => vehicle.ownerId === null || users.some((user) => user.id === vehicle.ownerId && user.role === 'resident' && user.residenceId === vehicle.residenceId))) return false
  }
  if (version >= 3) {
    const { inhabitants } = value
    if (!Array.isArray(inhabitants)) return false
    if (!inhabitants.every((person) => hasStrings(person, ['id', 'residenceId', 'firstName'])
      && ['lastName', 'email', 'phone', 'relationship'].every((key) => typeof person[key] === 'string')
      && typeof person.active === 'boolean'
      && residences.some((house) => house.id === person.residenceId)
      && (person.userId === null || users.some((user) => user.id === person.userId && user.role === 'resident' && user.residenceId === person.residenceId)))) return false
    if (new Set(inhabitants.map((person) => person.id)).size !== inhabitants.length) return false
    const linked = inhabitants.filter((person) => person.userId !== null)
    if (new Set(linked.map((person) => person.userId)).size !== linked.length) return false
    if (!users.every((user) => user.role === 'admin' || linked.some((person) => person.userId === user.id))) return false
    if (!residences.every((house) => typeof house.active === 'boolean' && (house.principalUserId === null || inhabitants.some((person) => person.userId === house.principalUserId && person.residenceId === house.id && person.active)))) return false
    if (!vehicles.every((vehicle) => vehicle.ownerId === null || inhabitants.some((person) => person.id === vehicle.ownerId && person.residenceId === vehicle.residenceId))) return false
  }
  if ([users, condominiums, residences, vehicles].some((items) => new Set(items.map((item) => item.id)).size !== items.length)) return false
  if (new Set(users.map((user) => user.email.toLowerCase())).size !== users.length) return false
  if (version === 4 && !validStoredContacts(value.contacts, users)) return false
  return session === null || (hasStrings(session, ['userId']) && users.some((user) => user.id === session.userId))
}

export function isDemoDatabase(value: unknown): value is DemoDatabase {
  return isDatabase(value, 4)
}

export function isLegacyDemoDatabase(value: unknown): value is LegacyDemoDatabase | DemoDatabaseV2 | DemoDatabaseV3 {
  return isDatabase(value, 1) || isDatabase(value, 2) || isDatabase(value, 3)
}
