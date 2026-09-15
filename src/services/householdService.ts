import type { InhabitantInput, VehicleInput } from '../types/community.js'
import { inhabitantName } from '../utils/people.js'
import { inhabitantFields, requireHouseholdManager, vehicleFields } from './communityRules.js'
import { readDemoData, saveDemoData } from './demoStorage.js'

export const householdService = {
  async createInhabitant(residenceId: string, input: InhabitantInput): Promise<void> {
    const data = readDemoData()
    requireHouseholdManager(data, residenceId)
    data.inhabitants.push({ ...inhabitantFields(input), id: crypto.randomUUID(), residenceId, userId: null })
    saveDemoData(data)
  },

  async updateInhabitant(residenceId: string, id: string, input: InhabitantInput): Promise<void> {
    const data = readDemoData()
    const residence = requireHouseholdManager(data, residenceId)
    const person = data.inhabitants.find((item) => item.id === id && item.residenceId === residenceId)
    if (!person) throw new Error('No se encontró ese habitante en la casa.')
    const fields = inhabitantFields(input)
    if (!fields.active && person.userId === residence.principalUserId) throw new Error('El administrador debe asignar otro residente principal antes de desactivar al actual.')
    Object.assign(person, fields)
    const account = data.users.find((user) => user.id === person.userId)
    if (account) account.name = inhabitantName(person)
    saveDemoData(data)
  },

  async createVehicle(residenceId: string, input: VehicleInput): Promise<void> {
    const data = readDemoData()
    const residence = requireHouseholdManager(data, residenceId)
    data.vehicles.push({ ...vehicleFields(data, residence, input), id: crypto.randomUUID(), residenceId })
    saveDemoData(data)
  },

  async updateVehicle(residenceId: string, id: string, input: VehicleInput): Promise<void> {
    const data = readDemoData()
    const residence = requireHouseholdManager(data, residenceId)
    const vehicle = data.vehicles.find((item) => item.id === id && item.residenceId === residenceId)
    if (!vehicle) throw new Error('No se encontró ese vehículo en la casa.')
    Object.assign(vehicle, vehicleFields(data, residence, input, id))
    saveDemoData(data)
  },

  async deleteVehicle(residenceId: string, id: string): Promise<void> {
    const data = readDemoData()
    requireHouseholdManager(data, residenceId)
    if (!data.vehicles.some((vehicle) => vehicle.id === id && vehicle.residenceId === residenceId)) throw new Error('No se encontró ese vehículo en la casa.')
    data.vehicles = data.vehicles.filter((vehicle) => vehicle.id !== id)
    saveDemoData(data)
  },
}
