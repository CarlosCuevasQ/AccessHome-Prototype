import { sharedMode } from './shared/provider.js'
import { sharedPublicInvitation } from './shared/adapters.js'
import type { DemoDatabase } from '../types/demo.js'
import type { Invitation, PublicInvitation, VisitVehicle } from '../types/invitations.js'
import { readDemoData, saveDemoData } from './demoStorage.js'
import { invitationStatus, visitVehicle } from './invitationRules.js'

function requireToken(data: DemoDatabase, token: string): Invitation {
  const invitation = data.invitations.find((item) => item.token === token.trim())
  if (!invitation) throw new Error('Invitación no disponible. Comprueba el enlace con tu anfitrión.')
  return invitation
}

function canAddVehicle(data: DemoDatabase, invitation: Invitation): boolean {
  return invitation.vehicle === null && invitation.usedUses === 0 && invitationStatus(invitation) === 'activa'
    && data.residences.some((house) => house.id === invitation.residenceId && house.active)
}

const localService = {
  async getInvitation(token: string): Promise<PublicInvitation> {
    const data = readDemoData()
    const invitation = requireToken(data, token)
    // La vista por token recibe únicamente los datos necesarios para esta visita.
    return {
      token: invitation.token, visitorName: invitation.visitorName,
      residenceName: invitation.residenceName,
      condominiumName: data.condominiums.find(condo => data.residences.some(house => house.id === invitation.residenceId && house.condominiumId === condo.id))?.name ?? '',
      startsAt: invitation.startsAt, expiresAt: invitation.expiresAt,
      status: invitationStatus(invitation),
    }
  },

  async addVehicle(token: string, input: VisitVehicle): Promise<void> {
    const data = readDemoData()
    const invitation = requireToken(data, token)
    if (!canAddVehicle(data, invitation)) throw new Error('Solo puedes añadir un vehículo a una invitación activa sin vehículo y antes de su primer uso.')
    invitation.vehicle = visitVehicle(input)
    saveDemoData(data)
  },
}

export const publicInvitationService = sharedMode ? sharedPublicInvitation : localService
