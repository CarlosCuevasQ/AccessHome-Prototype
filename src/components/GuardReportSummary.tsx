import type { ShiftPreview } from '../types/guardReports'
import { shiftMetricLabels } from '../types/guardReports'
import { formatDate } from '../utils/dates'

export function GuardReportSummary({ report }: { report: ShiftPreview }) {
  return <section aria-label="Resumen del turno">
    <h2>{report.condominium_name}</h2><p>Guardia responsable: <strong>{report.guard_name}</strong></p>
    <p>Desde {formatDate(report.period_start, report.time_zone)} hasta {formatDate(report.period_end, report.time_zone)}.</p>
    <p className="form-help">Zona: {report.time_zone}. Inicio incluido, fin excluido. Actividad de todo el condominio, no solo de este guardia.</p>
    <dl className="summary-strip shift-metrics">{Object.entries(shiftMetricLabels).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{report.metrics[key as keyof typeof shiftMetricLabels] ?? 'No disponible'}</dd></div>)}</dl>
    <p>Los pendientes corresponden al momento de generar el resumen, incluso de turnos anteriores. Cerrar turno no registra salidas.</p>
    <p className="form-help">No existe una bitácora verificable de rechazos de visitantes; no se contabilizan como cero. Los rechazos de servicios sí se registran.</p>
    <p>Calculado: {formatDate(report.generated_at, report.time_zone)}</p>
  </section>
}
