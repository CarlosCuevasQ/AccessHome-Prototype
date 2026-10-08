export const serviceCategories = { paqueteria: 'Paquetería', comida: 'Entrega de comida', transporte: 'Transporte', mantenimiento: 'Mantenimiento', otro: 'Otro servicio' } as const
export const serviceStates = { registrado: 'Registrado', rechazado: 'Rechazado', en_sitio: 'En sitio', finalizado: 'Finalizado', cancelado: 'Cancelado' } as const
export const serviceOperations = { register: 'Llegada registrada', allow: 'Entrada permitida', reject: 'Acceso rechazado', cancel: 'Registro cancelado', exit: 'Salida registrada' } as const
export type ServiceState = keyof typeof serviceStates
export type ServiceOperation = keyof typeof serviceOperations
export interface ServiceInput {
  category: keyof typeof serviceCategories
  residenceId: string
  company: string
  providerName: string
  plates: string
  notes: string
}
export interface ServiceEvent {
  id: string
  operation: ServiceOperation
  actorName: string
  occurredAt: string
  method: 'MANUAL' | null
  reason: string
}
export interface ServiceVisit extends Omit<ServiceInput, 'residenceId'> {
  id: string
  residenceName: string
  status: ServiceState
  registeredAt: string
  expiresAt: string
  expired: boolean
  events: ServiceEvent[]
}
export interface ServiceList {
  records: ServiceVisit[]
  hasMore: boolean
  timeZone: string
  registeredCount: number
  insideCount: number
}
export interface ServiceResult { record: ServiceVisit; replayed: boolean }
