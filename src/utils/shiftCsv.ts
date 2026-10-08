import { shiftMetricLabels } from '../types/guardReports.js'
import type { ShiftReport } from '../types/guardReports.js'

// Quote every cell and neutralize spreadsheet formula prefixes, including whitespace.
export function csvCell(value: string | number) {
  const text = String(value)
  const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text
  return '"' + safe.replaceAll('"', '""') + '"'
}
export function shiftCsv(report: ShiftReport) {
  const rows: (string | number)[][] = [
    ['Campo', 'Valor'], ['Reporte', report.id], ['Guardia', report.guard_name], ['Condominio', report.condominium_name],
    ['Zona horaria', report.time_zone], ['Inicio (ISO, con offset)', report.period_start], ['Fin (ISO, con offset)', report.period_end],
    ['Generado (ISO, con offset)', report.generated_at], ['Estado', report.status], ['Versión de métricas', report.metric_version],
    ...Object.entries(shiftMetricLabels).map(([key, label]) => [label, report.metrics[key as keyof typeof shiftMetricLabels] ?? 'No disponible']),
    ['Observaciones', report.notes], ['Incidencias', report.incidents],
  ]
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
