import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { reportsService } from '../services/reportsService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { formatDate } from '../utils/dates'
import { ReportStatusLabel } from '../components/ReportStatusLabel'

export function ReportsPage() {
  usePageTitle('Reportes')
  const load = useCallback(async () => ({ context: await reportsService.getContext(), reports: await reportsService.listReports() }), [])
  const { data, error, loading } = useCommunityQuery(load)
  const base = data?.context.administrative ? '/admin' : '/residente'
  return <section className="community-page">
    <p className="eyebrow">Atención a residentes</p>
    <div className="page-heading"><div><h1>{data?.context.administrative ? 'Reportes del condominio' : 'Mis reportes'}</h1><p className="lead">{data?.context.administrative ? 'Consulta y da seguimiento a las solicitudes de los residentes.' : 'Consulta el avance de los reportes que has enviado a la administración.'}</p></div>
      {data?.context.canCreate && <Link className="button-link" to="/residente/reportes/nuevo">Crear reporte</Link>}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && <p role="status">Cargando reportes…</p>}
    {data && <>{!data.context.administrative && !data.context.canCreate && <p className="access-notice">Puedes consultar tus reportes. Para crear uno debes ser el principal de una residencia activa.</p>}
      <p className="result-count">{data.reports.length} {data.reports.length === 1 ? 'reporte' : 'reportes'}</p>
      {data.reports.length ? <table className="data-table"><caption className="sr-only">Reportes disponibles para tu cuenta</caption>
        <thead><tr><th>Reporte</th><th>Autor / Residencia</th><th>Fecha</th><th>Estado</th><th>Detalle</th></tr></thead>
        <tbody>{data.reports.map((report) => <tr key={report.id}>
          <td data-label="Reporte">{report.title}<span className="cell-secondary">{report.category}</span></td>
          <td data-label="Autor / Casa">{report.authorName}<span className="cell-secondary">{report.residenceName}</span></td>
          <td data-label="Fecha">{formatDate(report.createdAt)}</td>
          <td data-label="Estado"><ReportStatusLabel status={report.status} /></td>
          <td data-label="Detalle"><Link to={`${base}/reportes/${report.id}`} aria-label={`Ver reporte: ${report.title}`}>Ver detalle</Link></td>
        </tr>)}</tbody>
      </table> : <p className="empty-list">Todavía no hay reportes para mostrar.</p>}
    </>}
  </section>
}
