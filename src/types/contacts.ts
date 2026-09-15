export interface ContactVehicle {
  id: string
  plates: string
  brand: string
  model: string
  color: string
  active: boolean
}

export interface FrequentContact {
  id: string
  ownerUserId: string
  name: string
  phone: string
  email: string
  notes: string
  active: boolean
  vehicles: ContactVehicle[]
}

export type ContactInput = Pick<FrequentContact, 'name' | 'phone' | 'email' | 'notes' | 'active'>
export type ContactVehicleInput = Omit<ContactVehicle, 'id'>
export interface ContactAccess { canManage: boolean }
