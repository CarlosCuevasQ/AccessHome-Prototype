export type InvitationStatus = 'activa' | 'completada' | 'cancelada' | 'expirada'

export interface VisitVehicle {
  plates: string
  brand: string
  model: string
  color: string
}

export interface Invitation {
  id: string
  token: string
  inviterUserId: string
  inviterName: string
  residenceId: string
  residenceName: string
  contactId: string | null
  visitorName: string
  phone: string
  vehicle: VisitVehicle | null
  startsAt: string
  expiresAt: string
  maxUses: number
  usedUses: number
  status: InvitationStatus
  createdAt: string
}

export type InvitationValidity = { kind: 'today' | '24hours' } | { kind: 'custom'; startsAt: string; expiresAt: string }
export type VisitVehicleChoice = { kind: 'none' } | { kind: 'saved'; vehicleId: string } | { kind: 'other'; vehicle: VisitVehicle }
export type InvitationInput = { validity: InvitationValidity } & (
  { source: 'contact'; contactId: string; vehicleChoice: VisitVehicleChoice }
  | { source: 'occasional'; visitorName: string; phone: string; vehicle: VisitVehicle | null; saveAsContact: boolean }
)

export interface InvitationContext {
  residenceName: string
  canManage: boolean
}

export interface PublicInvitation {
  token: string
  visitorName: string
  residenceName: string
  inviterName: string
  startsAt: string
  expiresAt: string
  vehicle: VisitVehicle | null
  status: InvitationStatus
  usedUses: number
  maxUses: number
  canAddVehicle: boolean
}
