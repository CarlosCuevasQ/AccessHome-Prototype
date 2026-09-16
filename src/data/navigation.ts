import type { WorkspaceConfig, WorkspaceRole } from '../types/navigation'

export const workspaces: Record<WorkspaceRole, WorkspaceConfig> = {
  admin: {
    label: 'Administrador',
    title: 'Espacio de administración',
    description: 'Consulta tus datos de acceso y el condominio que administras.',
    navigation: [
      { label: 'Condominio', path: '/admin' }, { label: 'Residencias', path: '/admin/residencias', end: false },
      { label: 'Control de acceso', path: '/admin/control-acceso' }, { label: 'Historial de accesos', path: '/admin/historial' },
      { label: 'Reportes', path: '/admin/reportes', end: false }, { label: 'Mi perfil', path: '/admin/perfil' },
    ],
  },
  resident: {
    label: 'Residente',
    title: 'Espacio del residente',
    description: 'Consulta tus datos de acceso y la residencia a la que perteneces.',
    navigation: [
      { label: 'Inicio', path: '/residente' }, { label: 'Mi residencia', path: '/residente/mi-residencia' },
      { label: 'Contactos frecuentes', path: '/residente/contactos', end: false }, { label: 'Invitaciones', path: '/residente/invitaciones', end: false },
      { label: 'Historial de accesos', path: '/residente/historial' }, { label: 'Mis reportes', path: '/residente/reportes', end: false },
      { label: 'Mi perfil', path: '/residente/perfil' },
    ],
  },
}
