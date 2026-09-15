export type WorkspaceRole = 'admin' | 'resident'

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
