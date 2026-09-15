import type { FrequentContact } from '../types/contacts.js'

export function createDemoContacts(): FrequentContact[] {
  return [
    { id: 'contact-carlos', ownerUserId: 'user-daniel', name: 'Carlos López', phone: '3312345678', email: '', notes: '', active: true,
      vehicles: [{ id: 'contact-vehicle-carlos', plates: 'JKL-1234', brand: 'Mazda', model: '3', color: '', active: true }] },
    { id: 'contact-maria', ownerUserId: 'user-daniel', name: 'María González', phone: '', email: '', notes: '', active: true, vehicles: [] },
    { id: 'contact-pedro', ownerUserId: 'user-daniel', name: 'Pedro Ramírez', phone: '', email: '', notes: '', active: true,
      vehicles: [{ id: 'contact-vehicle-pedro', plates: 'HJK-7821', brand: 'Nissan', model: 'Versa', color: '', active: true }] },
  ]
}
