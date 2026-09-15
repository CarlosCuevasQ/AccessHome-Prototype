import type { SessionUser } from './auth.js'
import type { Condominium, Inhabitant, Residence, Vehicle } from './demo.js'

export type ResidenceInput = Pick<Residence, 'number' | 'street' | 'active'>
export type InhabitantInput = Omit<Inhabitant, 'id' | 'residenceId' | 'userId'>
export type PrincipalInput = { inhabitantId: string; loginEmail?: string } | { firstName: string; lastName: string; email: string }
export type VehicleInput = Omit<Vehicle, 'id' | 'residenceId'>
export type CondominiumInput = Pick<Condominium, 'name' | 'address'>

export interface ResidenceSummary extends Residence {
  principalName: string | null
  residentCount: number
  vehicleCount: number
}

export interface ResidenceDetails {
  condominium: Condominium
  residence: Residence
  inhabitants: Inhabitant[]
  primaryResident: SessionUser | null
  permissions: { manageStructure: boolean; manageHousehold: boolean }
  vehicles: Vehicle[]
}

export interface CondominiumSummary {
  condominium: Condominium
  residenceCount: number
  residentCount: number
  vehicleCount: number
  activeVehicleCount: number
}
