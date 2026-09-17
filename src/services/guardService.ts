import type { GuardDashboard, GuardHistory } from '../types/guard.js'
import type { AccessHistoryFilters } from '../types/access.js'
import { sharedMode } from './shared/provider.js'
import { rpc } from './shared/transport.js'

function requireShared() {
  if (!sharedMode) throw new Error('El panel de caseta requiere una cuenta real de Supabase y la migración de guardia.')
}
export const guardService = {
  async getDashboard(): Promise<GuardDashboard> {
    requireShared()
    return rpc('guard_dashboard')
  },
  async getHistory(movement: AccessHistoryFilters['type'] = '', page = 0): Promise<GuardHistory> {
    requireShared()
    return rpc('guard_history', { movement, page })
  },
}
