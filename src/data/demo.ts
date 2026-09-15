import type { DemoDatabase } from '../types/demo.js'

const demoPassword = 'Access123'

const initialData: DemoDatabase = {
  version: 1,
  users: [
    { id: 'user-admin', name: 'Administrador Demo', email: 'admin@accesshome.demo', password: demoPassword, role: 'admin', condominiumId: 'condo-encinos', residenceId: null },
    { id: 'user-daniel', name: 'Daniel Cuevas', email: 'residente@accesshome.demo', password: demoPassword, role: 'resident', condominiumId: 'condo-encinos', residenceId: 'house-24' },
  ],
  condominiums: [
    { id: 'condo-encinos', name: 'Residencial Los Encinos', address: 'Av. de los Encinos 120, Ciudad de México' },
  ],
  residences: [
    { id: 'house-24', condominiumId: 'condo-encinos', name: 'Casa 24', street: 'Circuito Robles' },
    { id: 'house-25', condominiumId: 'condo-encinos', name: 'Casa 25', street: 'Circuito Robles' },
  ],
  vehicles: [
    { id: 'vehicle-1', residenceId: 'house-24', plates: 'DEMO-024', brand: 'Nissan', model: 'Versa', color: 'Gris' },
    { id: 'vehicle-2', residenceId: 'house-24', plates: 'DEMO-124', brand: 'Toyota', model: 'Corolla', color: 'Blanco' },
  ],
  session: null,
}

export function createDemoData(): DemoDatabase {
  return structuredClone(initialData)
}

export function getDemoCredentials() {
  return initialData.users.map(({ name, email, password, role }) => ({ name, email, password, role }))
}
