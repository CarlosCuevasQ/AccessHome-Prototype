import type { UserRole } from './auth'

export type WorkspaceRole = UserRole

export interface NavigationItem {
  label: string
  path: string
}

export interface WorkspaceConfig {
  label: string
  title: string
  description: string
  navigation: NavigationItem[]
}
