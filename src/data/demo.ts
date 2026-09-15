import type { DemoDatabase } from '../types/demo.js'
import { inhabitantFromAccount } from '../utils/people.js'

export const DEMO_PASSWORD = 'Access123'

const initialData: DemoDatabase = {
  version: 3,
  users: [
    { id: 'user-admin', name: 'Administrador Demo', email: 'admin@accesshome.demo', password: DEMO_PASSWORD, role: 'admin', condominiumId: 'condo-encinos', residenceId: null },
    { id: 'user-daniel', name: 'Daniel Cuevas', email: 'residente@accesshome.demo', password: DEMO_PASSWORD, role: 'resident', condominiumId: 'condo-encinos', residenceId: 'house-24' },
    { id: 'user-mariana', name: 'Mariana Torres', email: 'mariana@accesshome.demo', password: DEMO_PASSWORD, role: 'resident', condominiumId: 'condo-encinos', residenceId: 'house-24' },
    { id: 'user-ana', name: 'Ana López', email: 'ana@accesshome.demo', password: DEMO_PASSWORD, role: 'resident', condominiumId: 'condo-encinos', residenceId: 'house-12' },
    { id: 'user-jorge', name: 'Jorge Mendoza', email: 'jorge@accesshome.demo', password: DEMO_PASSWORD, role: 'resident', condominiumId: 'condo-encinos', residenceId: 'house-12' },
    { id: 'user-luis', name: 'Luis Herrera', email: 'luis@accesshome.demo', password: DEMO_PASSWORD, role: 'resident', condominiumId: 'condo-encinos', residenceId: 'house-37' },
    { id: 'user-elena', name: 'Elena Ríos', email: 'elena@accesshome.demo', password: DEMO_PASSWORD, role: 'resident', condominiumId: 'condo-encinos', residenceId: 'house-51' },
  ],
  condominiums: [
    { id: 'condo-encinos', name: 'Residencial Los Robles', address: 'Av. de los Robles 120, Ciudad de México' },
  ],
  residences: [
    { id: 'house-12', condominiumId: 'condo-encinos', number: '12', name: 'Casa 12', street: 'Circuito Robles', active: true, principalUserId: 'user-ana' },
    { id: 'house-24', condominiumId: 'condo-encinos', number: '24', name: 'Casa 24', street: 'Circuito Robles', active: true, principalUserId: 'user-daniel' },
    { id: 'house-37', condominiumId: 'condo-encinos', number: '37', name: 'Casa 37', street: 'Paseo del Bosque', active: true, principalUserId: 'user-luis' },
    { id: 'house-51', condominiumId: 'condo-encinos', number: '51', name: 'Casa 51', street: 'Paseo del Bosque', active: true, principalUserId: 'user-elena' },
  ],
  inhabitants: [],
  vehicles: [
    { id: 'vehicle-1', residenceId: 'house-24', plates: 'DEMO-024', brand: 'Nissan', model: 'Versa', color: 'Gris', active: true, ownerId: 'user-daniel' },
    { id: 'vehicle-2', residenceId: 'house-24', plates: 'DEMO-124', brand: 'Toyota', model: 'Corolla', color: 'Blanco', active: false, ownerId: 'user-mariana' },
    { id: 'vehicle-12', residenceId: 'house-12', plates: 'DEMO-012', brand: 'Kia', model: 'Rio', color: 'Azul', active: true, ownerId: 'user-ana' },
    { id: 'vehicle-37', residenceId: 'house-37', plates: 'DEMO-037', brand: 'Mazda', model: 'CX-5', color: 'Rojo', active: true, ownerId: 'user-luis' },
    { id: 'vehicle-51', residenceId: 'house-51', plates: 'DEMO-051', brand: 'Honda', model: 'CR-V', color: 'Plata', active: true, ownerId: null },
  ],
  session: null,
}

initialData.inhabitants = initialData.users.filter((user) => user.role === 'resident').map(inhabitantFromAccount)
initialData.inhabitants.push(
  { id: 'inhabitant-andrea', residenceId: 'house-24', userId: null, firstName: 'Andrea', lastName: 'Cuevas', phone: '55 5550 2424', email: '', relationship: 'Familiar', active: true },
  { id: 'inhabitant-carlos', residenceId: 'house-24', userId: null, firstName: 'Carlos', lastName: 'Cuevas', phone: '', email: '', relationship: 'Familiar', active: true },
)
initialData.vehicles = initialData.vehicles.map((vehicle) => ({ ...vehicle, ownerId: vehicle.ownerId ? `inhabitant-${vehicle.ownerId}` : null }))

export function createDemoData(): DemoDatabase {
  return structuredClone(initialData)
}

export function getDemoCredentials() {
  return initialData.users.filter(({ id }) => id === 'user-admin' || id === 'user-daniel')
    .map(({ name, email, password, role }) => ({ name, email, password, role }))
}
