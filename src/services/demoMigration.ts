import { createDemoData } from '../data/demo.js'
import type { DemoDatabase, DemoDatabaseV2, LegacyDemoDatabase } from '../types/demo.js'
import { inhabitantFromAccount } from '../utils/people.js'

function migrateVersionOne(legacy: LegacyDemoDatabase): DemoDatabaseV2 {
  const seed = createDemoData()
  const residences: DemoDatabaseV2['residences'] = []
  for (const house of legacy.residences) {
    let number = Number(house.name.match(/\d+/)?.[0] ?? 1)
    if (!Number.isInteger(number) || number < 1 || number > 99999) number = 1
    while (residences.some((item) => item.condominiumId === house.condominiumId && item.number === String(number))) number++
    residences.push({ ...house, number: String(number) })
  }
  const data: DemoDatabaseV2 = {
    ...structuredClone(legacy), version: 2, residences,
    vehicles: legacy.vehicles.map((vehicle) => ({ ...vehicle, active: true, ownerId: null })),
  }
  const demoCondo = data.condominiums.find((item) => item.id === 'condo-encinos')
  if (demoCondo) {
    if (demoCondo.name === 'Residencial Los Encinos') demoCondo.name = seed.condominiums[0].name
    if (demoCondo.address === 'Av. de los Encinos 120, Ciudad de México') demoCondo.address = seed.condominiums[0].address
    const residenceIds = new Map<string, string>()
    for (const house of seed.residences) {
      const existing = data.residences.find((item) => item.id === house.id || (item.condominiumId === house.condominiumId && item.number === house.number))
      if (!existing) data.residences.push(house)
      residenceIds.set(house.id, existing?.id ?? house.id)
    }
    for (const user of seed.users) {
      if (!data.users.some((item) => item.id === user.id || item.email.toLowerCase() === user.email.toLowerCase())) {
        data.users.push({ ...user, residenceId: user.residenceId ? residenceIds.get(user.residenceId)! : null })
      }
    }
    for (const vehicle of seed.vehicles) {
      if (!data.vehicles.some((item) => item.id === vehicle.id || item.plates === vehicle.plates)) {
        const residenceId = residenceIds.get(vehicle.residenceId)!
        const ownerUserId = seed.inhabitants.find((item) => item.id === vehicle.ownerId)?.userId
        const owner = data.users.find((item) => item.id === ownerUserId && item.residenceId === residenceId)
        data.vehicles.push({ ...vehicle, residenceId, ownerId: owner?.id ?? null })
      }
    }
  }
  return data
}

export function migrateDemoData(legacy: LegacyDemoDatabase | DemoDatabaseV2): DemoDatabase {
  const previous = legacy.version === 1 ? migrateVersionOne(legacy) : structuredClone(legacy)
  const inhabitants = previous.users.filter((user) => user.role === 'resident').map(inhabitantFromAccount)
  const daniel = previous.users.find((user) => user.id === 'user-daniel' && user.role === 'resident')
  if (daniel) {
    for (const person of createDemoData().inhabitants.filter((item) => item.userId === null)) {
      if (!inhabitants.some((item) => item.residenceId === daniel.residenceId && item.firstName === person.firstName && item.lastName === person.lastName)) {
        inhabitants.push({ ...person, residenceId: daniel.residenceId! })
      }
    }
  }
  return {
    ...previous, version: 3, inhabitants,
    residences: previous.residences.map((house) => ({
      ...house, active: true,
      principalUserId: (daniel?.residenceId === house.id ? daniel : previous.users.find((user) => user.role === 'resident' && user.residenceId === house.id))?.id ?? null,
    })),
    vehicles: previous.vehicles.map((vehicle) => ({
      ...vehicle, ownerId: vehicle.ownerId === null ? null : inhabitants.find((person) => person.userId === vehicle.ownerId && person.residenceId === vehicle.residenceId)?.id ?? null,
    })),
  }
}
