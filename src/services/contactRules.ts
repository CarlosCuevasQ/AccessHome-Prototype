import type { DemoDatabase } from '../types/demo.js'
import type { ContactInput, ContactVehicleInput, FrequentContact } from '../types/contacts.js'
import { requiredText, requireResidence, requireUser, validEmail } from './communityRules.js'

export function requireContactUser(data: DemoDatabase, writing = false) {
  const user = requireUser(data)
  if (user.role !== 'resident') throw new Error('La agenda privada está disponible únicamente para el residente principal.')
  const residence = requireResidence(data, user, user.residenceId ?? '')
  if (residence.principalUserId !== user.id) throw new Error('La agenda privada está disponible únicamente para el residente principal.')
  if (writing && !residence.active) throw new Error('La residencia está inactiva. Puedes consultar tu agenda, pero no modificarla.')
  return { user, canManage: residence.active }
}

export function requireOwnContact(data: DemoDatabase, id: string, writing = false): FrequentContact {
  const { user } = requireContactUser(data, writing)
  const contact = data.contacts.find((item) => item.id === id && item.ownerUserId === user.id)
  if (!contact) throw new Error('Contacto no disponible. Solo puedes acceder a tus propios contactos.')
  return contact
}

function optionalText(value: string, label: string, max: number) {
  const text = value.trim()
  if (text.length > max) throw new Error(`${label}: admite hasta ${max} caracteres.`)
  return text
}

export function contactFields(input: ContactInput): ContactInput {
  if (typeof input.active !== 'boolean') throw new Error('Selecciona un estado válido para el contacto.')
  return {
    name: requiredText(input.name, 'Nombre', 100), phone: optionalText(input.phone, 'Teléfono', 30),
    email: input.email.trim() ? validEmail(input.email) : '', notes: optionalText(input.notes, 'Notas', 1000), active: input.active,
  }
}

export function contactVehicleFields(contact: FrequentContact, input: ContactVehicleInput, editingId?: string): ContactVehicleInput {
  const plates = requiredText(input.plates, 'Placas', 15).toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9 -]*$/.test(plates)) throw new Error('Las placas solo admiten letras, números, espacios y guiones.')
  const key = (value: string) => value.replace(/[\s-]/g, '').toUpperCase()
  if (contact.vehicles.some((vehicle) => vehicle.id !== editingId && key(vehicle.plates) === key(plates))) throw new Error('Estas placas ya están registradas en este contacto.')
  if (typeof input.active !== 'boolean') throw new Error('Selecciona un estado válido para el vehículo.')
  return { plates, brand: optionalText(input.brand, 'Marca', 60), model: optionalText(input.model, 'Modelo', 60), color: optionalText(input.color, 'Color', 40), active: input.active }
}
