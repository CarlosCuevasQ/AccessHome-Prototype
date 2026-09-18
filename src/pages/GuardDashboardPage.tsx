import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { guardService } from '../services/guardService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { AccessNotice } from '../components/AccessNotice'
import { RecentAccess } from '../components/access/RecentAccess'

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
  return <section className="community-page guard-page">
    <p className="eyebrow">Guardia / Caseta</p><AccessNotice />
    <h1>Panel de caseta</h1>
    {loading && <p role="status">Cargando actividad de caseta…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {data && <>
      <div className="guard-introduction">
        <div><h2>{data.condominiumName}</h2><p>Guardia: <strong>{data.guardName}</strong></p></div>
        <GuardClock serverTime={data.serverTime} timeZone={data.timeZone} />
      </div>
      <nav className="dashboard-actions guard-actions" aria-label="Acciones de caseta">
        <Link className="button-link guard-scan" to="/guardia/escanear">Escanear acceso</Link>
        <Link className="secondary-button" to="/guardia/historial">Historial</Link>
        <Link className="secondary-button" to="/guardia/servicios">Registrar servicio <small>Próxima etapa</small></Link>
        <Link className="secondary-button" to="/guardia/reportes">Reportes de turno <small>Próxima etapa</small></Link>
      </nav>
      <dl className="summary-strip guard-metrics">
        <div><dt>Accesos registrados hoy</dt><dd>{data.todayAccessCount}</dd></div>
        <div><dt>Visitas pendientes de salida</dt><dd>{data.pendingExitCount}</dd></div>
      </dl>
      <p className="form-help">Hoy incluye entradas y salidas en la zona horaria del condominio. Pendientes: entradas sin una salida registrada, incluso de días anteriores.</p>
      <div className="guard-updates"><p className="form-help">Actualización cada 30 segundos mientras esta pantalla esté visible.</p><button type="button" className="secondary-button" onClick={() => setRevision(value => value + 1)}>Actualizar</button></div>
      <div className="guard-recent">
        <RecentAccess records={data.recentEntries} title="Entradas recientes" timeZone={data.timeZone} empty="Todavía no hay entradas registradas." />
        <RecentAccess records={data.recentExits} title="Salidas recientes" timeZone={data.timeZone} empty="Todavía no hay salidas registradas." />
      </div>
      <RecentAccess records={data.pendingExits} title="Pendientes de salida" timeZone={data.timeZone} empty="No hay visitas con salida pendiente." />
      {data.pendingExitCount > data.pendingExits.length && <p className="form-help">Se muestran las 10 entradas pendientes más antiguas de {data.pendingExitCount}.</p>}
      <section className="community-section"><h2>Servicios pendientes</h2><p>El registro de servicios se habilitará en una próxima etapa. Todavía no hay un módulo para consultar este dato.</p></section>
    </>}
    {error && <button type="button" className="secondary-button" onClick={() => setRevision(value => value + 1)}>Volver a consultar</button>}
  </section>
}
