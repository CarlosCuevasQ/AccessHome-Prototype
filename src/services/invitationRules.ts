import type { DemoDatabase } from '../types/demo.js'
import type { Invitation, InvitationStatus, InvitationValidity, VisitVehicle } from '../types/invitations.js'
import { requireHouseholdManager, requireResidence, requireUser, requiredText } from './communityRules.js'

export function requireInvitationUser(data: DemoDatabase, writing = false) {
  const user = requireUser(data)
  if (user.role !== 'resident') throw new Error('Las invitaciones de esta sección corresponden a los residentes.')
  const residence = requireResidence(data, user, user.residenceId ?? '')
  if (writing) requireHouseholdManager(data, residence.id)
  return { user, residence, canManage: residence.active && residence.principalUserId === user.id }
}

export function requireOwnInvitation(data: DemoDatabase, id: string, writing = false): Invitation {
  const { residence } = requireInvitationUser(data, writing)
  const invitation = data.invitations.find((item) => item.id === id && item.residenceId === residence.id)
  if (!invitation) throw new Error('Invitación no disponible. Solo puedes acceder a invitaciones de tu residencia.')
  return invitation
}

export function invitationStatus(invitation: Invitation, now = Date.now()): InvitationStatus {
  if (invitation.status !== 'activa') return invitation.status
  if (invitation.usedUses >= invitation.maxUses) return 'completada'
  return now >= Date.parse(invitation.expiresAt) ? 'expirada' : 'activa'
}

export function validityWindow(validity: InvitationValidity, now = new Date(Date.now())) {
  let startsAt = new Date(now)
  let expiresAt = new Date(now)
  if (validity.kind === 'today') expiresAt.setHours(24, 0, 0, 0)
  else if (validity.kind === '24hours') expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  else if (validity.kind === 'custom') {
    startsAt = new Date(validity.startsAt)
    expiresAt = new Date(validity.expiresAt)
  } else throw new Error('Selecciona una vigencia válida.')
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(expiresAt.getTime())) throw new Error('Escribe fechas y horas válidas.')
  if (expiresAt <= startsAt) throw new Error('La fecha final debe ser posterior al inicio.')
  if (expiresAt <= now) throw new Error('La fecha final debe estar en el futuro.')
  return { startsAt: startsAt.toISOString(), expiresAt: expiresAt.toISOString() }
}

export function visitPhone(value: string) {
  const phone = value.trim()
  if (phone.length > 30) throw new Error('El teléfono admite hasta 30 caracteres.')
  return phone
}

export function visitVehicle(input: VisitVehicle): VisitVehicle {
  const plates = requiredText(input.plates, 'Placas', 15).toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9 -]*$/.test(plates)) throw new Error('Las placas solo admiten letras, números, espacios y guiones.')
  const fields = { plates, brand: input.brand.trim(), model: input.model.trim(), color: input.color.trim() }
  if (fields.brand.length > 60 || fields.model.length > 60 || fields.color.length > 40) throw new Error('Marca/modelo admiten hasta 60 caracteres y color hasta 40.')
  return fields
}
