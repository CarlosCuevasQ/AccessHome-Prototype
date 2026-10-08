import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { guardReportsService } from '../services/guardReportsService'
import { GuardReportForm } from '../components/GuardReportForm'
import { GuardReportSummary } from '../components/GuardReportSummary'
import { formatDate } from '../utils/dates'
import { GuardReportLog } from '../components/GuardReportLog'
import type { ShiftContext, ShiftFilters } from '../types/guardReports'

export function GuardReportPage({ administrative = false }: { administrative?: boolean }) {
  usePageTitle('Detalle del reporte de caseta')
  const { reportId = '' } = useParams()
  const load = useCallback(() => guardReportsService.detail(reportId), [reportId])
  const { data, error, loading } = useCommunityQuery(load)
  return <section className="community-page shift-page">
    <Link to={administrative ? '/admin/reportes-caseta' : '/guardia/reportes'}>Volver a reportes de caseta</Link><h1>Reporte de turno</h1>
    {loading && <p role="status">Consultando…</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {data && <><p>Finalizado · Snapshot guardado · Métricas v{data.metric_version}</p><GuardReportSummary report={data} />
      <h2>Observaciones</h2><p className="shift-text">{data.notes || 'Sin observaciones.'}</p><h2>Incidencias</h2><p className="shift-text">{data.incidents || 'Sin incidencias declaradas.'}</p>
      <p className="form-help">Los movimientos originales se conservan; este snapshot no cambia con las salidas posteriores.</p>
      <GuardReportLog key={data.id} report={data} /></>}
  </section>
}
export function GuardReportsPage({ administrative = false }: { administrative?: boolean }) {
  usePageTitle('Reportes de caseta')
  const navigate = useNavigate()
  const base = administrative ? '/admin/reportes-caseta' : '/guardia/reportes'
  const [form, setForm] = useState<ShiftContext | null>(null)
  const [filters, setFilters] = useState<ShiftFilters>({ from: '', to: '', guard: '', page: 0 })
  const [revision, setRevision] = useState(0)
  const contextLoad = useCallback(() => guardReportsService.context(), [revision])
  const context = useCommunityQuery(contextLoad, 30000)
  const load = useCallback(() => guardReportsService.list(filters), [filters, revision])
  const { data, error, loading } = useCommunityQuery(load, 30000)
  return <section className="community-page shift-page">
    <p className="eyebrow">{administrative ? 'Administrador' : 'Guardia'} / Reportes de caseta</p><h1>Reportes de caseta</h1>
    <p>{administrative ? 'Cierres auditables del condominio, separados de las incidencias residenciales.' : 'Tus cierres de turno. Cada reporte resume la actividad del condominio durante el periodo seleccionado.'}</p>
    {context.error && <p className="form-error" role="alert">{context.error}</p>}
    {form ? <GuardReportForm context={form} close={() => { setForm(null); setRevision(v => v + 1) }} done={result => navigate(`${base}/${result.report.id}`)} /> : <>
      {!administrative && <button className="button-link" disabled={!context.data} onClick={() => setForm(context.data)}>Generar reporte de turno</button>}
      <div className="shift-filters"><label>Fecha inicial del turno<input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value, page: 0 })} /></label>
        <label>Hasta fecha de inicio<input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value, page: 0 })} /></label>
        {administrative && <label>Guardia<select value={filters.guard} onChange={e => setFilters({ ...filters, guard: e.target.value, page: 0 })}><option value="">Todos</option>{context.data?.guards.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
        <button className="secondary-button" disabled={loading} onClick={() => setRevision(v => v + 1)}>Actualizar reportes</button>
      </div><p className="form-help">Filtros por fecha de inicio en la zona guardada de cada reporte. Actualización cada 30 segundos visibles.</p>
      {loading && <p role="status">Consultando reportes…</p>}{error && <p className="form-error" role="alert">{error}</p>}
      {data && <>{!data.records.length && <p>No hay reportes en esta página.</p>}
        <ul className="service-list">{data.records.map(r => <li key={r.id}>
          <h2><Link to={`${base}/${r.id}`}>{r.guard_name} · Finalizado</Link></h2>
          <p>{formatDate(r.period_start, r.time_zone)} — {formatDate(r.period_end, r.time_zone)} · {r.time_zone}</p>
          <p>Visitantes: {r.metrics.visitorEntries} entradas / {r.metrics.visitorExits} salidas. Servicios: {r.metrics.serviceArrivals} llegadas / {r.metrics.serviceEntries} entradas / {r.metrics.serviceExits} finalizados / {r.metrics.serviceRejections} rechazados.</p>
          <p>Pendientes al generar: {r.metrics.openVisits} visitas y {r.metrics.openServices} servicios.</p>
          <p className="shift-text">Incidencias: {r.incidents || 'Sin incidencias declaradas.'}</p>
        </li>)}</ul>
        <nav className="guard-pagination" aria-label="Páginas de reportes"><button className="secondary-button" disabled={!filters.page} onClick={() => setFilters({ ...filters, page: (filters.page ?? 0) - 1 })}>Anterior</button><span>Página {(filters.page ?? 0) + 1}</span><button className="secondary-button" disabled={!data.hasMore} onClick={() => setFilters({ ...filters, page: (filters.page ?? 0) + 1 })}>Siguiente</button></nav>
      </>}
    </>}
  </section>
}
