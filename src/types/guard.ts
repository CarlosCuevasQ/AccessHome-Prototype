import type { AccessRecord, AccessResult } from './access.js'

export type GuardAccess = Pick<AccessRecord, 'id' | 'visitorName' | 'residenceName' | 'type' | 'method' | 'occurredAt'> & {
  vehicle: { plates: string } | null
}
export type GuardScanRecord = Omit<GuardAccess, 'vehicle'> & Pick<AccessRecord, 'vehicle' | 'validatorName' | 'invitationStatusBefore' | 'invitationEffectiveStatusBefore'>
export type GuardScanResult = AccessResult<GuardScanRecord>
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
export interface GuardHistory {
  timeZone: string
  from: string
  to: string
  hasMore: boolean
  records: GuardAccess[]
}
