import type { ShiftPreview } from '../types/guardReports'
import { formatDate } from '../utils/dates'

export function GuardReportSummary({ report }: { report: ShiftPreview }) {
  return <section aria-label="Resumen del turno" className="executive-report">
    <div className="shift-identity"><div><p className="eyebrow">Cierre de turno</p><h2>{report.condominium_name}</h2><p>Guardia responsable: <strong>{report.guard_name}</strong></p></div>
      <dl className="shift-period"><div><dt>Inicio</dt><dd>{formatDate(report.period_start, report.time_zone)}</dd></div><div><dt>Fin</dt><dd>{formatDate(report.period_end, report.time_zone)}</dd></div></dl>
    </div>
    <p className="form-help">Zona: {report.time_zone}. Inicio incluido, fin excluido. Actividad de todo el condominio, no solo de este guardia.</p>
    <div className="executive-grid">
      <section className="executive-visits"><h3>Visitantes</h3><dl className="paired-stats"><div><dt>Entradas de visitantes</dt><dd>{report.metrics.visitorEntries}</dd></div><div><dt>Salidas de visitantes</dt><dd>{report.metrics.visitorExits}</dd></div></dl><p className="form-help">Rechazos de visitantes: {report.metrics.visitorRejections ?? 'No disponible'}. No existe una bitácora verificable de estos rechazos.</p></section>
      <section className="executive-services"><h3>Servicios y repartidores</h3><dl className="inline-stats"><div><dt>Servicios registrados</dt><dd>{report.metrics.serviceArrivals}</dd></div><div><dt>Servicios con entrada</dt><dd>{report.metrics.serviceEntries}</dd></div><div><dt>Servicios finalizados</dt><dd>{report.metrics.serviceExits}</dd></div><div><dt>Servicios rechazados</dt><dd>{report.metrics.serviceRejections}</dd></div></dl></section>
    </div>
    <section className="shift-pending-line" aria-label="Pendientes al cierre"><h3>Pendientes al cierre</h3><dl><div><dt>Visitas</dt><dd>{report.metrics.openVisits}</dd></div><div><dt>Servicios dentro</dt><dd>{report.metrics.openServices}</dd></div></dl></section>
    <p className="form-help">Pendientes al generar el resumen, incluso de turnos anteriores. Cerrar turno no registra salidas. Calculado: {formatDate(report.generated_at, report.time_zone)}.</p>
  </section>
}
