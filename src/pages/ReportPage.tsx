import { Skeleton } from '../components/Skeleton'
import { useCallback, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { ActionLink } from '../components/ActionLink'
import { FadeContent } from '../components/react-bits/FadeContent'
import { reportsService } from '../services/reportsService'
import type { ReportStatus } from '../types/reports'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { formatDate } from '../utils/dates'
import { ReportStatusLabel } from '../components/ReportStatusLabel'

export function ReportPage() {
  const { reportId = '' } = useParams()
  const location = useLocation()
  const load = useCallback(async () => ({ context: await reportsService.getContext(), report: await reportsService.getReport(reportId) }), [reportId])
  const { data, error, loading } = useCommunityQuery(load)
  const [saving, setSaving] = useState(false)
  const [updateError, setUpdateError] = useState('')
  const [message, setMessage] = useState('')
  usePageTitle(data?.report.title ?? 'Reporte')
  async function advance(status: ReportStatus) {
    setSaving(true); setUpdateError(''); setMessage('')
    try { await reportsService.updateStatus(reportId, status); setMessage('Estado del reporte actualizado.') }
    catch (error) { setUpdateError(error instanceof Error ? error.message : 'No se pudo actualizar el estado.') }
    finally { setSaving(false) }
  }
  return <section className={`community-page reports-page ${data?.context.administrative ? '' : 'resident-experience resident-report-detail'}`}>
    {loading && <Skeleton variant="report" label="Cargando reporte…" />}
    {error && <><h1>Reporte no disponible</h1><p className="form-error" role="alert">{error}</p></>}
    {data && <><ActionLink variant="back" to={`${data.context.administrative ? '/admin' : '/residente'}/reportes`}>Volver a reportes</ActionLink>
      {location.state?.created && <p className="form-success" role="status">Reporte enviado a la administración.</p>}
      <FadeContent className="resident-title"><header><div><p className="eyebrow">{data.report.category}</p><h1>{data.report.title}</h1><p className="muted">Creado el {formatDate(data.report.createdAt)}</p></div><ReportStatusLabel status={data.report.status} /></header></FadeContent>
      <div className="report-detail-grid"><section className="report-narrative"><h2>Descripción del reporte</h2><p className="report-description">{data.report.description}</p></section>
      <aside className="report-metadata" aria-label="Datos del reporte"><h2>Seguimiento</h2><dl className="detail-fields"><div><dt>Autor</dt><dd>{data.report.authorName}</dd></div><div><dt>Residencia</dt><dd>{data.report.residenceName}</dd></div><div><dt>Categoría</dt><dd>{data.report.category}</dd></div><div><dt>Fecha de creación</dt><dd>{formatDate(data.report.createdAt)}</dd></div><div><dt>Última actualización</dt><dd>{formatDate(data.report.updatedAt)}</dd></div></dl></aside></div>
      {message && <p className="form-success" role="status">{message}</p>}{updateError && <p className="form-error" role="alert">{updateError}</p>}
      {data.context.administrative && data.report.status !== 'completado' && <button className="button-link" disabled={saving} onClick={() => { void advance(data.report.status === 'pendiente' ? 'en_proceso' : 'completado') }}>{saving ? 'Guardando…' : data.report.status === 'pendiente' ? 'Marcar en proceso' : 'Marcar completado'}</button>}
    </>}
  </section>
}
