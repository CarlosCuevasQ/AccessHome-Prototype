import type { AccessInvitationOption, AccessRecord, AccessResult } from '../types/access.js'
import { readDemoData, saveDemoData } from './demoStorage.js'
import { invitationStatus } from './invitationRules.js'
import { rejectedAccess, requireAccessAdmin } from './accessRules.js'
import { generateId } from '../utils/id.js'

export const accessService = {
  async listActiveInvitations(): Promise<AccessInvitationOption[]> {
    const data = readDemoData()
    const admin = requireAccessAdmin(data)
    const houses = new Set(data.residences.filter((house) => house.condominiumId === admin.condominiumId).map((house) => house.id))
    return data.invitations.filter((item) => houses.has(item.residenceId) && invitationStatus(item) === 'activa')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ token, visitorName, residenceName, startsAt, expiresAt, usedUses }) => ({ token, visitorName, residenceName, startsAt, expiresAt, usedUses }))
  },

  async listAccessRecords(): Promise<AccessRecord[]> {
    const data = readDemoData()
    const admin = requireAccessAdmin(data)
    const houses = new Set(data.residences.filter((house) => house.condominiumId === admin.condominiumId).map((house) => house.id))
    return data.accessRecords.filter((record) => houses.has(record.residenceId))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  },

  async validateToken(token: string): Promise<AccessResult> {
    const data = readDemoData()
    const admin = requireAccessAdmin(data)
    const invitation = data.invitations.find((item) => item.token === token.trim())
    const residence = data.residences.find((house) => house.id === invitation?.residenceId && house.condominiumId === admin.condominiumId)
    if (!invitation || !residence) return rejectedAccess('not_found')
    const now = Date.now()
    const status = invitationStatus(invitation, now)
    if (status === 'cancelada') return rejectedAccess('cancelled')
    if (status === 'completada' || invitation.usedUses >= invitation.maxUses || invitation.usedUses >= 2) return rejectedAccess('completed')
    if (status === 'expirada') return rejectedAccess('expired')
    if (now < Date.parse(invitation.startsAt)) return rejectedAccess('outside_period')
    if (!residence.active) return rejectedAccess('inactive_residence')

    const record: AccessRecord = {
      id: generateId(), invitationId: invitation.id,
      visitorName: invitation.visitorName, residenceId: invitation.residenceId, residenceName: invitation.residenceName,
      inviterUserId: invitation.inviterUserId, inviterName: invitation.inviterName,
      vehicle: invitation.vehicle ? { ...invitation.vehicle } : null,
      type: invitation.usedUses === 0 ? 'entrada' : 'salida', method: 'QR', occurredAt: new Date(now).toISOString(), authorized: true,
    }
    invitation.usedUses++
    if (invitation.usedUses >= invitation.maxUses || invitation.usedUses >= 2) invitation.status = 'completada'
    data.accessRecords.push(record)
    // Uso y movimiento se guardan juntos; un fallo no deja un acceso consumido sin registro.
    saveDemoData(data)
    return { authorized: true, record, usedUses: invitation.usedUses, maxUses: invitation.maxUses, status: invitation.status }
  },
}
