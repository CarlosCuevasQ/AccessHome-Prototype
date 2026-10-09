import { FadeContent } from '../components/react-bits/FadeContent'
import { Icon } from '../components/Icon'
import { Skeleton } from '../components/Skeleton'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { guardService } from '../services/guardService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { AccessNotice } from '../components/AccessNotice'
import { RecentAccess } from '../components/access/RecentAccess'
import { ServiceSummary } from '../components/services/ServiceSummary'

function GuardClock({ serverTime, timeZone }: { serverTime: string; timeZone: string }) {
  const [now, setNow] = useState(new Date(serverTime).getTime())
  useEffect(() => {
    const start = performance.now()
    const sync = () => setNow(new Date(serverTime).getTime() + performance.now() - start)
    sync()
    const timer = window.setInterval(sync, 1000)
    return () => window.clearInterval(timer)
  }, [serverTime])
  return <div className="guard-clock">
    <time dateTime={new Date(now).toISOString()}>{new Intl.DateTimeFormat('es-MX', { dateStyle: 'full', timeStyle: 'medium', timeZone }).format(now)}</time>
    <span className="cell-secondary">Hora del condominio · {timeZone}</span>
  </div>
}

export function GuardDashboardPage() {
  usePageTitle('Panel de caseta')
  const [revision, setRevision] = useState(0)
  const load = useCallback(() => guardService.getDashboard(), [revision])
  const { data, error, loading } = useCommunityQuery(load, 30000)
  return <section className="community-page guard-page editorial-dashboard guard-home">
    <AccessNotice />
    <FadeContent className="editorial-header"><header><div><p className="eyebrow">Guardia / Caseta</p><h1>{data?.guardName ?? 'Panel de caseta'}</h1><p className="lead">{data?.condominiumName ?? 'Tu punto de control'}</p></div>{data && <GuardClock serverTime={data.serverTime} timeZone={data.timeZone} />}</header></FadeContent>
    {loading && <Skeleton variant="dashboard" label="Cargando actividad de caseta…" />}
    {error && <p className="form-error" role="alert">{error}</p>}
    {data && <>
      <div className="editorial-grid">
        <div className="editorial-main"><section className="scan-launch"><Icon name="scan" /><p className="eyebrow">Control de acceso</p><h2>Recibe la próxima visita</h2><p>Verifica el código del visitante y registra su entrada o salida.</p><Link className="button-link" to="/guardia/escanear"><Icon name="scan" />Escanear acceso</Link></section>
          <section className="open-module"><div className="section-heading"><h2>Visitantes dentro</h2><span className="status-badge">{data.pendingExitCount} pendientes</span></div>
            <RecentAccess records={data.pendingExits.slice(0, 3)} compactHeading title="Pendientes de salida" timeZone={data.timeZone} empty="No hay visitantes con salida pendiente." />
            {data.pendingExitCount > 3 && <p className="form-help">Las 3 entradas pendientes más antiguas de {data.pendingExitCount}. Consulta las demás en Salida sin QR.</p>}
            <Link className="text-button" to="/guardia/salidas"><Icon name="exit" />Registrar salida sin QR</Link>
          </section>
        </div>
        <aside className="editorial-aside" aria-label="Estado de caseta">
          <section className="now-module"><p className="eyebrow">Actividad de hoy</p><div className="hero-number"><strong>{data.todayAccessCount}</strong><span>movimientos</span></div><p>Entradas y salidas en la zona horaria del condominio.</p><Link to="/guardia/historial">Consultar historial<Icon name="arrow" /></Link></section>
          <ServiceSummary />
          <Link className="utility-link" to="/guardia/servicios"><Icon name="package" /><span><strong>Registrar servicio</strong><small>Captura la llegada y decide en caseta.</small></span><Icon name="arrow" /></Link>
          <Link className="utility-link" to="/guardia/reportes"><Icon name="report" /><span><strong>Reportes de turno</strong><small>Revisa y genera el cierre.</small></span><Icon name="arrow" /></Link>
        </aside>
      </div>
      <div className="guard-activity"><RecentAccess records={data.recentEntries} title="Entradas recientes" timeZone={data.timeZone} empty="Todavía no hay entradas registradas." /><RecentAccess records={data.recentExits} title="Salidas recientes" timeZone={data.timeZone} empty="Todavía no hay salidas registradas." /></div>
      <div className="guard-updates"><p className="form-help">Actualización cada 30 segundos. Los pendientes incluyen visitas de días anteriores.</p><button type="button" className="secondary-button" onClick={() => setRevision(value => value + 1)}>Actualizar</button></div>
    </>}
    {error && <button type="button" className="secondary-button" onClick={() => setRevision(value => value + 1)}>Volver a consultar</button>}
  </section>
}
