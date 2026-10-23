import { sharedMode } from './shared/provider.js'
import { rpc } from './shared/transport.js'
import type { GuardStatusChange, ManagedGuard } from '../types/guard.js'

// Solo modo compartido: rol y condominio salen del perfil autenticado en SQL; el navegador
// envía únicamente el guardia y el estado. Sin escritura directa de tablas.
function requireShared() {
  if (!sharedMode) throw new Error('La gestión de guardias requiere Supabase y la migración 20261021000300.')
}

// 42501 llega como mensaje genérico; aquí se explica en términos de guardias.
const unavailable = 'Este guardia ya no está disponible en tu condominio o tu cuenta no tiene permiso. Actualiza la lista.'

export const guardManagementService = {
  async list(): Promise<ManagedGuard[]> {
    requireShared()
    return rpc<ManagedGuard[]>('list_guards')
  },
  async setStatus(guardId: string, enabled: boolean): Promise<GuardStatusChange> {
    requireShared()
    if (!guardId) throw new Error('Selecciona un guardia.')
    try {
      return await rpc<GuardStatusChange>('set_guard_status', { guard_id: guardId, enabled }, true)
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('No tienes permiso')) throw new Error(unavailable)
      throw error
    }
  },
}
