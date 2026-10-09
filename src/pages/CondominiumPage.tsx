import { FadeContent } from '../components/react-bits/FadeContent'
import { Icon } from '../components/Icon'
import { Disclosure } from '../components/Disclosure'
import { Skeleton } from '../components/Skeleton'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardService } from '../services/dashboardService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAuth } from '../hooks/useAuth'
import { CondominiumForm } from '../components/community/CondominiumForm'
import { AccessNotice } from '../components/AccessNotice'
import { RecentAccess } from '../components/access/RecentAccess'

export function CondominiumPage() {
  usePageTitle('Mi condominio')
  const { user } = useAuth()
  const { data, error, loading } = useCommunityQuery(dashboardService.getAdminDashboard, 1000)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  return (
    <section className="community-page editorial-dashboard admin-home">
      <AccessNotice />
      <FadeContent className="editorial-header"><header><div><p className="eyebrow">Administración / Condominio</p><h1>{data?.condominium.name ?? 'Mi condominio'}</h1><p className="lead">Bienvenido, {user?.name}. Así se mueve tu comunidad.</p></div><Link className="button-link" to="/admin/historial"><Icon name="history" />Consultar actividad</Link></header></FadeContent>
      {error && <p role="alert" className="form-error">{error}</p>}
      {loading && <Skeleton variant="dashboard" label="Cargando condominio…" />}
      {message && <p role="status" className="form-success">{message}</p>}
      {data && <>
        <div className="editorial-grid">
          <div className="editorial-main"><section className="admin-snapshot" aria-label="Actividad actual"><div><p className="eyebrow">Accesos de hoy</p><div className="hero-number"><strong>{data.todayAccessCount}</strong><span>movimientos</span></div><p className="form-help">Entradas y salidas del día local.</p></div><dl className="inline-stats"><div><dt>Invitaciones activas</dt><dd>{data.activeInvitationCount}</dd></div><div><dt>Reportes pendientes</dt><dd>{data.pendingReportCount}</dd></div></dl></section><RecentAccess records={data.recentAccess} historyPath="/admin/historial" /></div>
          <aside className="editorial-aside" aria-label="Supervisión del condominio"><section className="residence-module"><div className="section-heading"><h2>Tu comunidad</h2><Icon name="home" /></div><dl className="inline-stats"><div><dt>Residencias</dt><dd>{data.residenceCount}</dd></div><div><dt>Habitantes activos</dt><dd>{data.activeInhabitantCount}</dd></div><div><dt>Vehículos registrados</dt><dd>{data.vehicleCount}</dd></div></dl><Link className="text-button" to="/admin/residencias">Gestionar residencias<Icon name="arrow" /></Link></section>
            <Link className="utility-link" to="/admin/reportes"><Icon name="report" /><span><strong>{data.pendingReportCount} reportes pendientes</strong><small>Solicitudes de tu comunidad.</small></span><Icon name="arrow" /></Link>
            <Link className="utility-link" to="/admin/reportes-caseta"><Icon name="shield" /><span><strong>Reportes de caseta</strong><small>Cierres y bitácora del turno.</small></span><Icon name="arrow" /></Link>
            <Link className="utility-link" to="/admin/servicios"><Icon name="package" /><span><strong>Servicios y repartidores</strong><small>Llegadas, decisiones y movimientos.</small></span><Icon name="arrow" /></Link>
            <Disclosure title="Herramientas de acceso"><Link className="secondary-button" to="/admin/control-acceso">Control de acceso</Link></Disclosure>
          </aside>
        </div>
        <p className="form-help metric-definitions">Invitaciones activas: incluye las programadas. Vehículos: registros permanentes, activos e inactivos.</p>
        <section className="community-section" aria-labelledby="condo-info">
          <div className="section-heading"><h2 id="condo-info">Información del condominio</h2><button className="text-button" onClick={() => { setEditing(true); setMessage('') }}>Editar información</button></div>
          {editing ? <CondominiumForm condominium={data.condominium} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); setMessage('Información del condominio actualizada.') }} /> : <p className="lead">{data.condominium.address}</p>}
        </section>
      </>}
    </section>
  )
}
