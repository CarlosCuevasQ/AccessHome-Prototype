import { Icon } from '../components/Icon'
import { ActionLink } from '../components/ActionLink'
import { Disclosure } from '../components/Disclosure'
import { Skeleton } from '../components/Skeleton'
import { FadeContent } from '../components/react-bits/FadeContent'
import { UpcomingInvitations } from '../components/UpcomingInvitations'
import { Link } from 'react-router-dom'
import { dashboardService } from '../services/dashboardService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { AccessNotice } from '../components/AccessNotice'
import { RecentAccess } from '../components/access/RecentAccess'

export function ResidentDashboardPage() {
  const { data, error, loading } = useCommunityQuery(dashboardService.getResidentDashboard, 1000)
  usePageTitle(data ? `Inicio · ${data.residence.name}` : 'Inicio')
  return <section className="community-page editorial-dashboard resident-home resident-experience">
    <AccessNotice />
    <FadeContent className="editorial-header"><header>
      <div className="home-identity"><span className="entity-symbol"><Icon name="home" /></span><div><p className="eyebrow">Tu residencia</p><h1>{data?.residence.name ?? 'Mi residencia'}</h1><p className="lead">{data?.residence.street ?? 'Tu casa y tus próximas visitas.'}</p></div></div>
      {data?.canManage && <Link className="button-link primary-invitation" to="/residente/invitaciones/nueva"><Icon name="plus" />Nueva invitación</Link>}
    </header></FadeContent>
    {loading && <Skeleton variant="dashboard" label="Cargando resumen…" />}{error && <p className="form-error" role="alert">{error}</p>}
    {data && <>
      {!data.canManage && <p className="access-notice">Tienes acceso de consulta. La gestión corresponde al principal de una residencia activa.</p>}
      <div className="editorial-grid">
        <UpcomingInvitations />
          <section className="now-module resident-current" aria-label="Estado de tus visitas"><p className="eyebrow">Tus visitas</p><div className="hero-number"><strong>{data.activeInvitationCount}</strong><span>{data.activeInvitationCount === 1 ? 'invitación activa' : 'invitaciones activas'}</span></div><p>Incluye las programadas.</p>
            <dl className="inline-stats"><div><dt>Visitas en los últimos 7 días</dt><dd>{data.recentVisitCount}</dd></div></dl><ActionLink variant="detail" to="/residente/invitaciones">Consultar invitaciones</ActionLink>
          </section>
        <div className="editorial-main"><RecentAccess records={data.recentAccess} historyPath="/residente/historial" /></div>
        <aside className="editorial-aside" aria-label="Mi residencia y accesos rápidos">
          <section className="residence-module"><div className="section-heading"><h2>En casa</h2><Icon name="home" /></div>
            <dl className="paired-stats"><div><dt>Habitantes</dt><dd>{data.inhabitantCount}</dd></div><div><dt>Vehículos</dt><dd>{data.vehicleCount}</dd></div></dl>
            <ActionLink variant="detail" to="/residente/mi-residencia">Ver mi residencia</ActionLink>
            {data.canManage && <Disclosure title="Gestionar mi residencia"><Link className="secondary-button" to="/residente/mi-residencia?accion=vehiculo">Registrar vehículo</Link><Link className="secondary-button" to="/residente/mi-residencia?accion=habitante">Agregar habitante</Link><Link className="secondary-button" to="/residente/reportes/nuevo">Crear reporte</Link></Disclosure>}
          </section>
          {data.isPrincipal && <Link className="utility-link" to="/residente/contactos"><Icon name="people" /><span><strong>Contactos frecuentes</strong><small>Tu próxima invitación, más rápido.</small></span><Icon name="arrow" /></Link>}
          <Link className="utility-link" to="/residente/reportes"><Icon name="report" /><span><strong>{data.pendingReportCount} {data.pendingReportCount === 1 ? 'reporte pendiente' : 'reportes pendientes'}</strong><small>Seguimiento con administración.</small></span><Icon name="arrow" /></Link>
        </aside>
      </div>
    </>}
  </section>
}
