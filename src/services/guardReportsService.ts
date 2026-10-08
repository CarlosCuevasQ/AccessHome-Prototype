import { sharedMode } from './shared/provider.js'
import { rpc } from './shared/transport.js'
import { generateSharedShift } from './shared/adapters.js'
import type { ShiftContext, ShiftFilters, ShiftInput, ShiftPeriod, ShiftPreview, ShiftReport, ShiftResult } from '../types/guardReports.js'

function request<T>(operation: string, input: unknown = {}): Promise<T> {
  if (!sharedMode) throw new Error('Los reportes de caseta requieren Supabase y la migración de reportes de turno.')
  return rpc<T>('guard_reports', { operation, input })
}
export const guardReportsService = {
  context: () => request<ShiftContext>('context'),
  list: (filters: ShiftFilters = {}) => request<{ records: ShiftReport[]; hasMore: boolean }>('list', filters),
  detail: (id: string) => request<ShiftReport>('detail', { id }),
  preview: ({ start, end }: ShiftPeriod) => request<ShiftPreview>('preview', { start, end }),
  generate: ({ start, end, notes, incidents }: ShiftInput): Promise<ShiftResult> => {
    if (!sharedMode) throw new Error('El cierre de turno requiere Supabase.')
    return generateSharedShift({ start, end, notes, incidents })
  },
}
