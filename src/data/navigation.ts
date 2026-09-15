import type { WorkspaceConfig, WorkspaceRole } from '../types/navigation'

export const workspaces: Record<WorkspaceRole, WorkspaceConfig> = {
  admin: {
    label: 'Administrador',
    title: 'Espacio de administración',
    description: 'Consulta tus datos de acceso y el condominio que administras.',
    navigation: [{ label: 'Condominio', path: '/admin' }, { label: 'Residencias', path: '/admin/residencias', end: false }, { label: 'Mi perfil', path: '/admin/perfil' }],
  },
  resident: {
    label: 'Residente',
    title: 'Espacio del residente',
    description: 'Consulta tus datos de acceso y la residencia a la que perteneces.',
    navigation: [{ label: 'Mi residencia', path: '/residente' }, { label: 'Contactos frecuentes', path: '/residente/contactos', end: false }, { label: 'Mi perfil', path: '/residente/perfil' }],
  },
}
