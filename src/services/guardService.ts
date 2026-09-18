import type { GuardDashboard, GuardHistory, GuardOpenVisits, GuardScanResult } from '../types/guard.js'
import type { AccessHistoryFilters } from '../types/access.js'
import { sharedMode } from './shared/provider.js'
import { rpc } from './shared/transport.js'
import { registerSharedExit, validateSharedAccess } from './shared/adapters.js'

function requireShared() {
  if (!sharedMode) throw new Error('El panel de caseta requiere una cuenta real de Supabase y la migración de guardia.')
}
export const guardService = {
  async getOpenVisits(page = 0): Promise<GuardOpenVisits> {
    requireShared()
    return rpc('guard_open_visits', { page })
  },
  async registerExit(entryId: string): Promise<GuardScanResult> {
    requireShared()
    return registerSharedExit(entryId)
  },
  async validateToken(token: string, method: 'QR' | 'MANUAL'): Promise<GuardScanResult> {
    requireShared()
    return validateSharedAccess(token, method)
  },
  async getDashboard(): Promise<GuardDashboard> {
    requireShared()
    return rpc('guard_dashboard')
  },
  async getHistory(movement: AccessHistoryFilters['type'] = '', page = 0): Promise<GuardHistory> {
    requireShared()
    return rpc('guard_history', { movement, page })
  },
}
