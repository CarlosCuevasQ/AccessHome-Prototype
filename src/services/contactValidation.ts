import type { DemoAccount } from '../types/demo.js'

export function validStoredContacts(value: unknown, users: DemoAccount[]): boolean {
  if (!Array.isArray(value)) return false
  const vehicleIds = new Set<string>()
  for (const contact of value) {
    if (!contact || typeof contact !== 'object'
      || !['id', 'ownerUserId', 'name'].every((key) => typeof contact[key] === 'string' && contact[key].trim())
      || !['phone', 'email', 'notes'].every((key) => typeof contact[key] === 'string')
      || typeof contact.active !== 'boolean' || !Array.isArray(contact.vehicles)
      || !users.some((user) => user.id === contact.ownerUserId && user.role === 'resident')) return false
    const plates = new Set<string>()
    for (const vehicle of contact.vehicles) {
      if (!vehicle || typeof vehicle !== 'object'
        || typeof vehicle.id !== 'string' || !vehicle.id.trim()
        || typeof vehicle.plates !== 'string' || !vehicle.plates.trim()
        || !['brand', 'model', 'color'].every((key) => typeof vehicle[key] === 'string')
        || typeof vehicle.active !== 'boolean' || vehicleIds.has(vehicle.id)) return false
      const key = vehicle.plates.replace(/[\s-]/g, '').toUpperCase()
      if (plates.has(key)) return false
      plates.add(key)
      vehicleIds.add(vehicle.id)
    }
  }
  return new Set(value.map((contact) => contact.id)).size === value.length
}
