import type { Invitation, InvitationContext, InvitationInput, InvitationStatus } from '../types/invitations.js'
import { readDemoData, saveDemoData, subscribeToDemoChanges } from './demoStorage.js'
import { invitationStatus, requireInvitationUser, requireOwnInvitation, validityWindow } from './invitationRules.js'
import { createVisitorSnapshot } from './invitationSnapshot.js'

const searchKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()

export const invitationsService = {
  subscribe: subscribeToDemoChanges,

  async getContext(): Promise<InvitationContext> {
    const { residence, canManage } = requireInvitationUser(readDemoData())
    return { residenceName: residence.name, canManage }
  },

  async listInvitations(search = '', status: InvitationStatus | 'todas' = 'todas'): Promise<Invitation[]> {
    const data = readDemoData()
    const { residence } = requireInvitationUser(data)
    const now = Date.now()
    return data.invitations.filter((item) => item.residenceId === residence.id)
      .map((item) => ({ ...item, status: invitationStatus(item, now) }))
      .filter((item) => (status === 'todas' || item.status === status) && searchKey(`${item.visitorName} ${item.phone} ${item.vehicle?.plates ?? ''}`).includes(searchKey(search)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async getInvitation(id: string): Promise<Invitation> {
    const invitation = requireOwnInvitation(readDemoData(), id)
    return { ...invitation, status: invitationStatus(invitation) }
  },

  async createInvitation(input: InvitationInput): Promise<string> {
    const data = readDemoData()
    const { user, residence } = requireInvitationUser(data, true)
    if ('residenceId' in input && input.residenceId !== residence.id) throw new Error('No puedes generar invitaciones para otra residencia.')
    const createdAt = new Date(Date.now())
    const validity = validityWindow(input.validity, createdAt)
    const snapshot = createVisitorSnapshot(data, input)
    if (input.source === 'occasional' && input.saveAsContact) {
      snapshot.contactId = crypto.randomUUID()
      data.contacts.push({
        id: snapshot.contactId, ownerUserId: user.id, name: snapshot.visitorName, phone: snapshot.phone, email: '', notes: '', active: true,
        vehicles: snapshot.vehicle ? [{ ...snapshot.vehicle, id: crypto.randomUUID(), active: true }] : [],
      })
    }
    let token: string
    do { token = crypto.randomUUID() } while (data.invitations.some((item) => item.token === token))
    const id = crypto.randomUUID()
    data.invitations.push({
      ...snapshot, ...validity, id, token, inviterUserId: user.id, inviterName: user.name,
      residenceId: residence.id, residenceName: residence.name, maxUses: 2, usedUses: 0, status: 'activa', createdAt: createdAt.toISOString(),
    })
    saveDemoData(data)
    return id
  },

  async cancelInvitation(id: string): Promise<void> {
    const data = readDemoData()
    const invitation = requireOwnInvitation(data, id, true)
    if (invitationStatus(invitation) !== 'activa') throw new Error('Solo se puede cancelar una invitación activa.')
    invitation.status = 'cancelada'
    saveDemoData(data)
  },
}
