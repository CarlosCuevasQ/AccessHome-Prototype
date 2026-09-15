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
}

export interface Vehicle {
  id: string
  residenceId: string
  plates: string
  brand: string
  model: string
  color: string
}

export interface DemoDatabase {
  version: 1
  users: DemoAccount[]
  condominiums: Condominium[]
  residences: Residence[]
  vehicles: Vehicle[]
  session: { userId: string } | null
}
