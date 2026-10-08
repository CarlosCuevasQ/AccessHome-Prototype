export const shiftMetricLabels = {
  visitorEntries: 'Entradas de visitantes', visitorExits: 'Salidas de visitantes',
  serviceArrivals: 'Servicios registrados', serviceEntries: 'Servicios con entrada',
  serviceExits: 'Servicios finalizados', serviceRejections: 'Servicios rechazados',
  openVisits: 'Visitas pendientes al generar', openServices: 'Servicios dentro al generar',
  visitorRejections: 'Rechazos de visitantes',
} as const
export type ShiftMetrics = Record<Exclude<keyof typeof shiftMetricLabels, 'visitorRejections'>, number> & { visitorRejections: null }
export interface ShiftPeriod { start: string; end: string }
export interface ShiftInput extends ShiftPeriod { notes: string; incidents: string }
export interface ShiftPreview {
  guard_name: string; condominium_name: string; time_zone: string
  period_start: string; period_end: string; generated_at: string; metrics: ShiftMetrics
}
export interface ShiftReport extends ShiftPreview {
  id: string; condominium_id: string; guard_user_id: string; notes: string; incidents: string
  status: 'finalizado'; metric_version: number
}
export interface ShiftContext { timeZone: string; condominiumName: string; guardName: string; start: string; end: string; guards: { id: string; name: string }[] }
export interface ShiftFilters { from?: string; to?: string; guard?: string; page?: number }
export interface ShiftResult { report: ShiftReport; replayed: boolean }
export type ShiftLogKind = 'all' | 'visitor' | 'service'
export interface ShiftLogItem {
  occurredAt: string; type: 'visitor' | 'service'; inPeriod: boolean; movement: string
  name: string; company: string; category: string; residence: string; vehicle: string; plates: string
  method: string; result: string; arrivalAt: string | null; entryAt: string | null; exitAt: string | null
  pendingExit: boolean; guard: string; notes: string
}
export interface ShiftLogPage { records: ShiftLogItem[]; total: number; hasMore: boolean; timeZone: string; legacy: boolean }
