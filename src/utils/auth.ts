import type { UserRole } from '../types/auth.js'

export function getRoleHome(role: UserRole): string {
  const homes: Record<UserRole, string> = { admin: '/admin', resident: '/residente', guard: '/guardia' }
  return homes[role]
}
