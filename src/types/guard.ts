import type { AccessRecord, AccessResult } from './access.js'

export type GuardAccess = Pick<AccessRecord, 'id' | 'visitorName' | 'residenceName' | 'type' | 'method' | 'occurredAt'> & {
  vehicle: { plates: string } | null
}
export type GuardScanRecord = Omit<GuardAccess, 'vehicle'> & Pick<AccessRecord, 'vehicle' | 'validatorName' | 'invitationStatusBefore' | 'invitationEffectiveStatusBefore'>
export type GuardScanResult = AccessResult<GuardScanRecord>
export interface GuardOpenVisits {
  timeZone: string
  hasMore: boolean
  records: GuardAccess[]
}
export interface GuardDashboard {
  guardName: string
  condominiumName: string
  timeZone: string
  serverTime: string
  todayAccessCount: number
  recentEntries: GuardAccess[]
  recentExits: GuardAccess[]
  pendingExitCount: number
  pendingExits: GuardAccess[]
}
// Administración de guardias (list_guards / set_guard_status). El bloqueo del responsable no se expone.
export interface ManagedGuard {
  id: string
  name: string
  active: boolean
  createdAt: string
}
export interface GuardStatusChange {
  id: string
  name: string
  active: boolean
  changed: boolean
}
export interface GuardHistory {
  timeZone: string
  from: string
  to: string
  hasMore: boolean
  records: GuardAccess[]
}
