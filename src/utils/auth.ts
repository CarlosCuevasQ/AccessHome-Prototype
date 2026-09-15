import type { UserRole } from '../types/auth'

export function getRoleHome(role: UserRole): string {
  return role === 'admin' ? '/admin' : '/residente'
}
