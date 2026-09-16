import type { Invitation } from '../types/invitations.js'
import { validStoredVisitVehicle } from './invitationValidation.js'

export function validStoredAccessRecords(value: unknown, invitations: Invitation[]): boolean {
  if (!Array.isArray(value)) return false
  const ids = new Set<string>()
  const movements = new Set<string>()
  const counts = new Map<string, number>()
  for (const item of value) {
    if (!item || typeof item !== 'object'
      || !['id', 'invitationId', 'visitorName', 'residenceId', 'residenceName', 'inviterUserId', 'inviterName'].every((key) => typeof item[key] === 'string' && item[key].trim())
      || !['entrada', 'salida'].includes(item.type) || item.method !== 'QR' || item.authorized !== true
      || typeof item.occurredAt !== 'string' || !Number.isFinite(Date.parse(item.occurredAt))
      || !validStoredVisitVehicle(item.vehicle) || ids.has(item.id)) return false
    const invitation = invitations.find((record) => record.id === item.invitationId)
    const movementKey = `${item.invitationId}:${item.type}`
    if (!invitation || invitation.residenceId !== item.residenceId || invitation.inviterUserId !== item.inviterUserId || movements.has(movementKey)) return false
    const count = (counts.get(item.invitationId) ?? 0) + 1
    if (count > invitation.usedUses) return false
    counts.set(item.invitationId, count)
    movements.add(movementKey)
    ids.add(item.id)
  }
  return true
}
