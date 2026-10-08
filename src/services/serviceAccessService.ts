import type { ServiceInput, ServiceList, ServiceOperation, ServiceResult, ServiceState } from '../types/services.js'
import { sharedMode } from './shared/provider.js'
import { rpc } from './shared/transport.js'
import { runServiceCommand } from './shared/adapters.js'

function requireShared() {
  if (!sharedMode) throw new Error('Los accesos de servicios requieren Supabase y la migración de servicios.')
}
export const serviceAccessService = {
  async context(): Promise<{ residences: { id: string; name: string }[] }> {
    requireShared(); return rpc('service_context')
  },
  async list(status: ServiceState | 'todos' = 'todos', page = 0): Promise<ServiceList> {
    requireShared(); return rpc('list_services', { status_filter: status, page })
  },
  async register(input: ServiceInput): Promise<ServiceResult> {
    requireShared(); return runServiceCommand('register', null, input)
  },
  async decide(operation: Exclude<ServiceOperation, 'register'>, id: string, reason = ''): Promise<ServiceResult> {
    requireShared(); return runServiceCommand(operation, id, operation === 'reject' ? { reason } : {})
  },
}
