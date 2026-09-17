export type UserRole = 'admin' | 'resident' | 'guard'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  condominiumId: string
  residenceId: string | null
}

export interface LoginCredentials {
  email: string
  password: string
}
