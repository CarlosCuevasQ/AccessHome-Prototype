import type { UserRole } from './auth'

export type WorkspaceRole = UserRole

export interface NavigationItem {
  label: string
  path: string
  end?: boolean
}

export interface WorkspaceConfig {
  label: string
  title: string
  description: string
  navigation: NavigationItem[]
}
