import type { WorkspaceConfig, WorkspaceRole } from '../types/navigation'

export const workspaces: Record<WorkspaceRole, WorkspaceConfig> = {
  admin: {
    label: 'Administrador',
    title: 'Espacio de administración',
    description: 'La estructura para administrar la comunidad está lista. Las funciones de gestión se incorporarán en las siguientes etapas.',
    navigation: [{ label: 'Inicio', path: '/admin' }],
  },
  resident: {
    label: 'Residente',
    title: 'Espacio del residente',
    description: 'Este será tu espacio para consultar y gestionar el acceso a tu vivienda. Las funciones se incorporarán en las siguientes etapas.',
    navigation: [{ label: 'Inicio', path: '/residente' }],
  },
}
