import type { Invitation } from '../types/invitations.js'
import { invitationsService } from './invitationsService.js'
import { communityService } from './communityService.js'

// Resident detail: the invitation plus the authoritative state of its own house
// (residence_details, readable by every resident of that house). An inactive house
// admits no entry, so the detail must not present the QR as an entry code.
export async function loadResidentInvitation(id: string): Promise<{ invitation: Invitation; residenceActive: boolean }> {
  const invitation = await invitationsService.getInvitation(id)
  const { residence } = await communityService.getResidence(invitation.residenceId)
  if (residence.id !== invitation.residenceId || typeof residence.active !== 'boolean') throw new Error('No se pudo confirmar el estado de la residencia.')
  return { invitation, residenceActive: residence.active }
}
