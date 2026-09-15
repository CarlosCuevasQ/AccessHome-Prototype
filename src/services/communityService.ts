import type { CondominiumInput, CondominiumSummary, ResidenceDetails, ResidenceInput, ResidenceSummary } from '../types/community.js'
import { sessionUser } from './authService.js'
import { readDemoData, saveDemoData, subscribeToDemoChanges } from './demoStorage.js'
import { requireResidence, requireUser, requiredText, residenceFields } from './communityRules.js'
import { householdService } from './householdService.js'
import { assignPrincipal } from './principalService.js'

export const communityService = {
  ...householdService,
  assignPrincipal,
  subscribe: subscribeToDemoChanges,

  async getSummary(): Promise<CondominiumSummary> {
    const data = readDemoData()
    const user = requireUser(data, true)
    const residences = data.residences.filter((item) => item.condominiumId === user.condominiumId)
    const houseIds = new Set(residences.map((item) => item.id))
    const vehicles = data.vehicles.filter((item) => houseIds.has(item.residenceId))
    return {
      condominium: data.condominiums.find((item) => item.id === user.condominiumId)!,
      residenceCount: residences.length,
      residentCount: data.inhabitants.filter((item) => houseIds.has(item.residenceId)).length,
      vehicleCount: vehicles.length,
      activeVehicleCount: vehicles.filter((item) => item.active).length,
    }
  },

  async listResidences(search = ''): Promise<ResidenceSummary[]> {
    const data = readDemoData()
    const user = requireUser(data, true)
    const query = search.trim().toLowerCase().replace(/^casa\s*/, '')
    return data.residences.filter((item) => item.condominiumId === user.condominiumId && item.number.includes(query))
      .sort((a, b) => Number(a.number) - Number(b.number))
      .map((item) => ({
        ...item,
        principalName: data.users.find((user) => user.id === item.principalUserId)?.name ?? null,
        residentCount: data.inhabitants.filter((person) => person.residenceId === item.id).length,
        vehicleCount: data.vehicles.filter((vehicle) => vehicle.residenceId === item.id).length,
      }))
  },

  async getResidence(id?: string): Promise<ResidenceDetails> {
    const data = readDemoData()
    const user = requireUser(data)
    const residence = requireResidence(data, user, id ?? user.residenceId ?? '')
    const principal = data.users.find((item) => item.id === residence.principalUserId)
    return {
      residence,
      condominium: data.condominiums.find((item) => item.id === residence.condominiumId)!,
      inhabitants: data.inhabitants.filter((item) => item.residenceId === residence.id),
      primaryResident: principal ? sessionUser(principal) : null,
      permissions: { manageStructure: user.role === 'admin', manageHousehold: user.role === 'resident' && residence.principalUserId === user.id && residence.active },
      vehicles: data.vehicles.filter((item) => item.residenceId === residence.id),
    }
  },

  async updateCondominium(input: CondominiumInput): Promise<void> {
    const data = readDemoData()
    const user = requireUser(data, true)
    const condominium = data.condominiums.find((item) => item.id === user.condominiumId)!
    Object.assign(condominium, { name: requiredText(input.name, 'Nombre del condominio'), address: requiredText(input.address, 'Dirección', 200) })
    saveDemoData(data)
  },

  async createResidence(input: ResidenceInput): Promise<string> {
    const data = readDemoData()
    const user = requireUser(data, true)
    const fields = residenceFields(data, user.condominiumId, input)
    const id = crypto.randomUUID()
    data.residences.push({ ...fields, id, condominiumId: user.condominiumId, principalUserId: null })
    saveDemoData(data)
    return id
  },

  async updateResidence(id: string, input: ResidenceInput): Promise<void> {
    const data = readDemoData()
    const user = requireUser(data, true)
    const residence = requireResidence(data, user, id)
    Object.assign(residence, residenceFields(data, user.condominiumId, input, id))
    saveDemoData(data)
  },
}
