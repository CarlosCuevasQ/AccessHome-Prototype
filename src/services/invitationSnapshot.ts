import type { DemoDatabase } from '../types/demo.js'
import type { InvitationInput, VisitVehicle } from '../types/invitations.js'
import { requireOwnContact } from './contactRules.js'
import { requiredText } from './communityRules.js'
import { visitPhone, visitVehicle } from './invitationRules.js'

export function createVisitorSnapshot(data: DemoDatabase, input: InvitationInput) {
  if (input.source === 'occasional') {
    if (typeof input.saveAsContact !== 'boolean') throw new Error('Indica si deseas guardar el contacto.')
    return { contactId: null as string | null, visitorName: requiredText(input.visitorName, 'Nombre', 100), phone: visitPhone(input.phone), vehicle: input.vehicle === null ? null : visitVehicle(input.vehicle) }
  }
  if (input.source !== 'contact') throw new Error('Selecciona el origen de la invitación.')
  const contact = requireOwnContact(data, input.contactId, true)
  if (!contact.active) throw new Error('Reactiva el contacto antes de generar una invitación.')
  let vehicle: VisitVehicle | null = null
  if (input.vehicleChoice.kind === 'saved') {
    const vehicleId = input.vehicleChoice.vehicleId
    const saved = contact.vehicles.find((item) => item.id === vehicleId && item.active)
    if (!saved) throw new Error('Selecciona un vehículo activo de este contacto.')
    vehicle = visitVehicle(saved)
  } else if (input.vehicleChoice.kind === 'other') vehicle = visitVehicle(input.vehicleChoice.vehicle)
  else if (input.vehicleChoice.kind !== 'none') throw new Error('Selecciona cómo llegará el visitante.')
  // Copias de los datos usados: ningún dato histórico se resuelve desde el contacto después de guardar.
  return { contactId: contact.id, visitorName: contact.name, phone: contact.phone, vehicle }
}
