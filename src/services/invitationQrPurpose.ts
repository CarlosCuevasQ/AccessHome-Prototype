import type { InvitationStatus } from '../types/invitations.js'

// Presentation only: the RPC independently authorizes every movement.
export function invitationQrPurpose(status: InvitationStatus, hasOpenEntry = false) {
  if (status === 'activa') return 'access'
  if (hasOpenEntry === true && (status === 'expirada' || status === 'cancelada')) return 'exit'
  return 'unavailable'
}
