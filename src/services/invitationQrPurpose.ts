import type { InvitationStatus } from '../types/invitations.js'

export type InvitationQrPurpose = 'access' | 'exit' | 'unavailable' | 'inactive_residence'

// Presentation only: the RPC independently authorizes every movement.
// residenceActive only restricts; when it is missing the previous rules apply.
export function invitationQrPurpose(status: InvitationStatus, hasOpenEntry = false, residenceActive?: boolean): InvitationQrPurpose {
  const openVisit = hasOpenEntry === true && (status === 'activa' || status === 'expirada' || status === 'cancelada')
  if (residenceActive === false) return openVisit ? 'exit' : status === 'activa' ? 'inactive_residence' : 'unavailable'
  if (status === 'activa') return 'access'
  if (openVisit) return 'exit'
  return 'unavailable'
}
