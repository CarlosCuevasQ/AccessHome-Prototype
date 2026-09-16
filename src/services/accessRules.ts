import type { DemoDatabase } from '../types/demo.js'
import type { AccessRejection, AccessResult } from '../types/access.js'
import { requireUser } from './communityRules.js'

export function requireAccessAdmin(data: DemoDatabase) {
  const user = requireUser(data)
  if (user.role !== 'admin') throw new Error('Solo el administrador puede operar el control de acceso.')
  return user
}

const rejectionMessages: Record<AccessRejection, string> = {
  not_found: 'Invitación inexistente.',
  cancelled: 'Invitación cancelada.',
  expired: 'Invitación expirada.',
  completed: 'Invitación completada. No quedan usos disponibles.',
  outside_period: 'Fuera del periodo permitido. La vigencia aún no comienza.',
  inactive_residence: 'La residencia destino está inactiva.',
}

export function rejectedAccess(reason: AccessRejection): AccessResult {
  return { authorized: false, reason, message: rejectionMessages[reason] }
}
