import { useCallback, useEffect, useRef, useState } from 'react'
import { guardReportsService, loadShiftExport } from '../services/guardReportsService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import type { ShiftLogKind, ShiftReport } from '../types/guardReports'
import { shiftCategory, shiftCsv, shiftCsvFilename } from '../utils/shiftCsv'
import { formatDate } from '../utils/dates'

export function GuardReportLog({ report }: { report: ShiftReport }) {
  const [kind, setKind] = useState<ShiftLogKind>('all')
  const [page, setPage] = useState(0)
  const [newest, setNewest] = useState(false)
  const [revision, setRevision] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const exportRequest = useRef<AbortController | null>(null)
  const load = useCallback(() => guardReportsService.log(report.id, kind, page, newest), [report.id, kind, page, newest, revision])
  const { data, error, loading } = useCommunityQuery(load)
  useEffect(() => () => { exportRequest.current?.abort() }, [])
  const date = (value: string | null) => value ? formatDate(value, report.time_zone) : 'No registrada'
  async function exportCsv() {
    if (exportRequest.current) return
    const controller = new AbortController(); exportRequest.current = controller
    setExporting(true); setExportError('')
    try {
      const items = await loadShiftExport(report.id, controller.signal)
      controller.signal.throwIfAborted()
      const url = URL.createObjectURL(new Blob([shiftCsv(items, report.time_zone)], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a'); link.href = url; link.download = shiftCsvFilename(report.period_start, report.time_zone); link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      if (!controller.signal.aborted) setExportError(error instanceof Error ? error.message : 'No se pudo exportar la bitácora completa.')
    } finally {
      exportRequest.current = null
      if (!controller.signal.aborted) setExporting(false)
    }
  }
  return <section aria-label="Detalle del turno">
    <h2>Detalle del turno</h2>
    <p>Movimientos incluidos en el cierre y entradas pendientes al generarlo. Las pendientes fuera del periodo están identificadas y no suman como entradas del turno. Horas en {report.time_zone}.</p>
    <div className="shift-filters"><label>Tipo<select value={kind} onChange={e => { setKind(e.target.value as ShiftLogKind); setPage(0) }}><option value="all">Todos</option><option value="visitor">Visitantes</option><option value="service">Servicios</option></select></label>
      <label>Orden<select value={newest ? 'desc' : 'asc'} onChange={e => { setNewest(e.target.value === 'desc'); setPage(0) }}><option value="asc">Más antiguo primero</option><option value="desc">Más reciente primero</option></select></label></div>
    {loading && <p role="status">Consultando bitácora…</p>}
    {error && <div role="alert"><p className="form-error">{error}</p><button className="secondary-button" onClick={() => setRevision(v => v + 1)}>Reintentar detalle</button></div>}
    {data && <>
      {data.legacy && <p className="access-notice">Cierre anterior a la bitácora ampliada: solo se muestran referencias guardadas. Algunas horas relacionadas o cancelaciones pueden no estar disponibles; no se reconstruyen con el estado actual.</p>}
      <p>{data.total} registros · Página {page + 1}</p>
      {!data.records.length && <p>No hay movimientos de este tipo en esta página.</p>}
      <ol className="service-list shift-log">{data.records.map((item, index) => <li key={`${page}:${index}`}>
        <h3>{date(item.occurredAt)} · {item.type === 'visitor' ? 'Visitante' : 'Servicio'} · {item.movement}</h3>
        <p><strong>{item.name || item.company || 'Nombre no registrado'}</strong> · {item.residence}</p>
        {!item.inPeriod && <p className="access-notice">Pendiente fuera del periodo</p>}
        {item.type === 'service' && <p>{[item.company, shiftCategory(item.category)].filter(Boolean).join(' · ')}</p>}
        <p>Resultado del movimiento: {item.result}{item.method && ` · Método: ${item.method}`}</p>
        {item.pendingExit && <p className="access-notice"><strong>Pendiente de salida al generar el reporte</strong></p>}
        {(item.vehicle || item.plates) && <p>Vehículo: {item.vehicle || 'No especificado'}{item.plates && ` · Placas: ${item.plates}`}</p>}
        <dl className="shift-log-times">
          {item.type === 'service' && <div><dt>Llegada</dt><dd>{date(item.arrivalAt)}</dd></div>}
          <div><dt>Entrada</dt><dd>{date(item.entryAt)}</dd></div><div><dt>Salida al cierre</dt><dd>{date(item.exitAt)}</dd></div>
        </dl><p>Operador del movimiento: {item.guard || 'No registrado en el snapshot original'}</p>
        {item.notes && <p className="shift-text">Observaciones / motivo de rechazo: {item.notes}</p>}
      </li>)}</ol>
      <nav className="guard-pagination" aria-label="Páginas de bitácora"><button className="secondary-button" disabled={page === 0} onClick={() => setPage(v => v - 1)}>Anterior</button><span>Página {page + 1}</span><button className="secondary-button" disabled={!data.hasMore} onClick={() => setPage(v => v + 1)}>Siguiente</button></nav>
    </>}
    <h2>Exportar bitácora</h2><p className="form-help">CSV completo de visitantes y servicios, en orden cronológico, independiente del filtro visible. Máximo 10 000 filas; una fila por evento, sin totales ni identificadores internos.</p>
    <button className="secondary-button" disabled={exporting || !data} onClick={() => { void exportCsv() }}>{exporting ? 'Preparando CSV completo…' : 'Exportar CSV'}</button>
    {exportError && <p className="form-error" role="alert">{exportError}</p>}
  </section>
}
