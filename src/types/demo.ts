import type { SessionUser } from './auth.js'

export interface DemoAccount extends SessionUser {
  password: string
}

export interface Condominium {
  id: string
  name: string
  address: string
}

export interface Residence {
  id: string
  condominiumId: string
  name: string
  street: string
  number: string
  active: boolean
  principalUserId: string | null
}

export interface Inhabitant {
  id: string
  residenceId: string
  userId: string | null
  firstName: string
  lastName: string
  phone: string
  email: string
  relationship: string
  active: boolean
}

export interface Vehicle {
  id: string
  residenceId: string
  plates: string
  brand: string
  model: string
  color: string
  active: boolean
  ownerId: string | null
}

export interface DemoDatabase {
  version: 3
  users: DemoAccount[]
  condominiums: Condominium[]
  residences: Residence[]
  inhabitants: Inhabitant[]
  vehicles: Vehicle[]
  session: { userId: string } | null
}

export interface DemoDatabaseV2 extends Omit<DemoDatabase, 'version' | 'residences' | 'inhabitants'> {
  version: 2
  residences: Omit<Residence, 'active' | 'principalUserId'>[]
}

export interface LegacyDemoDatabase extends Omit<DemoDatabaseV2, 'version' | 'residences' | 'vehicles'> {
  version: 1
  residences: Omit<Residence, 'number' | 'active' | 'principalUserId'>[]
  vehicles: Omit<Vehicle, 'active' | 'ownerId'>[]
}
