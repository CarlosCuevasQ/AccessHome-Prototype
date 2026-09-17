import type { SessionUser } from './auth.js'
import type { FrequentContact } from './contacts.js'
import type { Invitation } from './invitations.js'
import type { AccessRecord } from './access.js'
import type { Report } from './reports.js'

export interface DemoAccount extends SessionUser {

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
  version: 7
  users: DemoAccount[]
  condominiums: Condominium[]
  residences: Residence[]
  inhabitants: Inhabitant[]
  vehicles: Vehicle[]
  contacts: FrequentContact[]
  invitations: Invitation[]
  accessRecords: AccessRecord[]
  reports: Report[]
  session: { userId: string } | null
}

export interface DemoDatabaseV6 extends Omit<DemoDatabase, 'version' | 'reports'> {
  version: 6
}

export interface DemoDatabaseV5 extends Omit<DemoDatabaseV6, 'version' | 'accessRecords'> {
  version: 5
}

export interface DemoDatabaseV4 extends Omit<DemoDatabaseV5, 'version' | 'invitations'> {
  version: 4
}

export interface DemoDatabaseV3 extends Omit<DemoDatabaseV4, 'version' | 'contacts'> {
  version: 3
}

export interface DemoDatabaseV2 extends Omit<DemoDatabaseV3, 'version' | 'residences' | 'inhabitants'> {
  version: 2
  residences: Omit<Residence, 'active' | 'principalUserId'>[]
}

export interface LegacyDemoDatabase extends Omit<DemoDatabaseV2, 'version' | 'residences' | 'vehicles'> {
  version: 1
  residences: Omit<Residence, 'number' | 'active' | 'principalUserId'>[]
  vehicles: Omit<Vehicle, 'active' | 'ownerId'>[]
}

