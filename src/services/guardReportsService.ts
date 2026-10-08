import { sharedMode } from './shared/provider.js'
import { rpc } from './shared/transport.js'
import { generateSharedShift } from './shared/adapters.js'
import type { ShiftContext, ShiftFilters, ShiftInput, ShiftPeriod, ShiftPreview, ShiftReport, ShiftResult } from '../types/guardReports.js'
import type { ShiftLogItem, ShiftLogKind, ShiftLogPage } from '../types/guardReports.js'

function request<T>(operation: string, input: unknown = {}): Promise<T> {
  if (!sharedMode) throw new Error('Los reportes de caseta requieren Supabase y la migración de reportes de turno.')
  return rpc<T>('guard_reports', { operation, input })
}
export const guardReportsService = {
  log: (id: string, kind: ShiftLogKind = 'all', page = 0, newestFirst = false): Promise<ShiftLogPage> => {
    if (!sharedMode) throw new Error('La bitácora de turno requiere Supabase.')
    return rpc<ShiftLogPage>('guard_report_log', { report_id: id, kind, page, newest_first: newestFirst })
  },
  context: () => request<ShiftContext>('context'),
  list: (filters: ShiftFilters = {}) => request<{ records: ShiftReport[]; hasMore: boolean }>('list', filters),
  detail: (id: string) => request<ShiftReport>('detail', { id }),
  preview: ({ start, end }: ShiftPeriod) => request<ShiftPreview>('preview', { start, end }),
  generate: ({ start, end, notes, incidents }: ShiftInput): Promise<ShiftResult> => {
    if (!sharedMode) throw new Error('El cierre de turno requiere Supabase.')
    return generateSharedShift({ start, end, notes, incidents })
  },
}

// Explicit export only; never download a partial CSV or load unbounded history.
export async function loadShiftExport(id: string, signal?: AbortSignal): Promise<ShiftLogItem[]> {
  const records: ShiftLogItem[] = []
  for (let page = 0; page < 200; page++) {
    signal?.throwIfAborted()
    const result = await guardReportsService.log(id, 'all', page, false)
    signal?.throwIfAborted()
    if (result.total > 10000) throw new Error('Este reporte supera 10 000 filas. Consulta la bitácora paginada; no se exportó un archivo parcial.')
    records.push(...result.records)
    if (!result.hasMore) {
      if (records.length !== result.total) throw new Error('La bitácora cambió durante la consulta. Vuelve a exportar; no se descargó un archivo parcial.')
      return records
    }
  }
  throw new Error('No se pudo completar la exportación dentro del límite de 10 000 filas.')
}
