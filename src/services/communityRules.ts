import type { DemoAccount, DemoDatabase, Residence } from '../types/demo.js'
import type { ResidenceInput, InhabitantInput, VehicleInput } from '../types/community.js'

export function accountIsActive(data: DemoDatabase, user: DemoAccount): boolean {
  return user.role === 'admin' || data.inhabitants.some((person) => person.userId === user.id && person.active)
}

export function requireUser(data: DemoDatabase, adminOnly = false): DemoAccount {
  const user = data.users.find((item) => item.id === data.session?.userId)
  if (!user || !accountIsActive(data, user)) throw new Error('Inicia sesión con una cuenta activa para consultar la comunidad.')
  if (adminOnly && user.role !== 'admin') throw new Error('Solo el administrador puede modificar la estructura del condominio o asignar al residente principal.')
  return user
}

export function requireResidence(data: DemoDatabase, user: DemoAccount, id: string): Residence {
  const residence = data.residences.find((item) => item.id === id && item.condominiumId === user.condominiumId)
  if (!residence) throw new Error('No se encontró esa residencia en tu condominio.')
  if (user.role === 'resident' && user.residenceId !== residence.id) throw new Error('Solo puedes acceder a tu propia residencia.')
  return residence
}

export function requireHouseholdManager(data: DemoDatabase, residenceId: string): Residence {
  const user = requireUser(data)
  const residence = requireResidence(data, user, residenceId)
  if (user.role !== 'resident' || residence.principalUserId !== user.id) throw new Error('Solo el residente principal puede administrar los habitantes y vehículos de su residencia.')
  if (!residence.active) throw new Error('La residencia está inactiva. Contacta al administrador para reactivarla.')
  return residence
}

export function requiredText(value: string, label: string, max = 100): string {
  const text = value.trim()
  if (!text || text.length > max) throw new Error(`${label}: escribe entre 1 y ${max} caracteres.`)
  return text
}

export function residenceFields(data: DemoDatabase, condominiumId: string, input: ResidenceInput, editingId?: string) {
  if (!/^\d{1,5}$/.test(input.number.trim()) || Number(input.number) < 1) throw new Error('El número de casa debe estar entre 1 y 99999.')
  const number = String(Number(input.number))
  if (data.residences.some((item) => item.condominiumId === condominiumId && item.number === number && item.id !== editingId)) throw new Error('Ya existe una residencia con ese número.')
  if (typeof input.active !== 'boolean') throw new Error('Selecciona un estado válido para la residencia.')
  return { number, name: `Casa ${number}`, street: requiredText(input.street, 'Calle o circuito'), active: input.active }
}

export function validEmail(value: string): string {
  const email = requiredText(value, 'Correo electrónico', 150).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Escribe un correo electrónico válido.')
  return email
}

export function inhabitantFields(input: InhabitantInput): InhabitantInput {
  const phone = input.phone.trim()
  const relationship = input.relationship.trim()
  if (phone.length > 30 || relationship.length > 100) throw new Error('El teléfono admite hasta 30 caracteres y la relación hasta 100.')
  if (typeof input.active !== 'boolean') throw new Error('Selecciona un estado válido para el habitante.')
  return {
    firstName: requiredText(input.firstName, 'Nombre', 60), lastName: requiredText(input.lastName, 'Apellido', 80),
    email: input.email.trim() ? validEmail(input.email) : '', phone, relationship, active: input.active,
  }
}

const plateKey = (plates: string) => plates.replace(/[\s-]/g, '').toUpperCase()

export function vehicleFields(data: DemoDatabase, residence: Residence, input: VehicleInput, editingId?: string): VehicleInput {
  const plates = requiredText(input.plates, 'Placas', 15).toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9 -]*$/.test(plates)) throw new Error('Las placas solo admiten letras, números, espacios y guiones.')
  const houses = new Set(data.residences.filter((item) => item.condominiumId === residence.condominiumId).map((item) => item.id))
  if (data.vehicles.some((item) => houses.has(item.residenceId) && plateKey(item.plates) === plateKey(plates) && item.id !== editingId)) throw new Error('Esas placas ya están registradas en el condominio.')
  if (typeof input.active !== 'boolean') throw new Error('Selecciona un estado válido para el vehículo.')
  if (input.ownerId !== null && !data.inhabitants.some((item) => item.id === input.ownerId && item.residenceId === residence.id)) throw new Error('El propietario principal debe ser un habitante de esta casa.')
  return { plates, brand: requiredText(input.brand, 'Marca', 60), model: requiredText(input.model, 'Modelo', 60), color: requiredText(input.color, 'Color', 40), active: input.active, ownerId: input.ownerId }
}
