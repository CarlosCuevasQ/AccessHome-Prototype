import type { InvitationStatus, VisitVehicle } from './invitations.js'

export interface AccessRecord {
  id: string
  invitationId: string
  visitorName: string
  residenceId: string
  residenceName: string
  inviterUserId: string
  inviterName: string
  vehicle: VisitVehicle | null
  type: 'entrada' | 'salida'
  method: 'QR'
  occurredAt: string
  authorized: true
}

export type AccessRejection = 'not_found' | 'cancelled' | 'expired' | 'completed' | 'outside_period' | 'inactive_residence'

export type AccessResult =
  | { authorized: true; record: AccessRecord; usedUses: number; maxUses: number; status: InvitationStatus }
  | { authorized: false; reason: AccessRejection; message: string }

export interface AccessInvitationOption {
  token: string
  visitorName: string
  residenceName: string
  startsAt: string
  expiresAt: string
  usedUses: number
}

export interface AccessHistoryFilters {
  search?: string
  residenceId?: string
  type?: 'entrada' | 'salida' | ''
  from?: string
  to?: string
}
