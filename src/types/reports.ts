export const reportCategories = ['Seguridad', 'Acceso', 'Instalaciones', 'Administración', 'Otro'] as const
export type ReportCategory = typeof reportCategories[number]
export type ReportStatus = 'pendiente' | 'en_proceso' | 'completado'
export const reportStatusLabels: Record<ReportStatus, string> = { pendiente: 'Pendiente', en_proceso: 'En proceso', completado: 'Completado' }

export interface Report {
  id: string
  condominiumId: string
  residenceId: string
  residenceName: string
  authorUserId: string
  authorName: string
  title: string
  category: ReportCategory
  description: string
  status: ReportStatus
  createdAt: string
  updatedAt: string
}

export type ReportInput = Pick<Report, 'title' | 'category' | 'description'>
