import { Link } from 'react-router-dom'
import { dashboardService } from '../services/dashboardService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { AccessNotice } from '../components/AccessNotice'
import { RecentAccess } from '../components/access/RecentAccess'

export function ResidentDashboardPage() {
  const { data, error, loading } = useCommunityQuery(dashboardService.getResidentDashboard, 1000)
  usePageTitle(data ? `Inicio · ${data.residence.name}` : 'Inicio')
  return <section className="community-page">
    <p className="eyebrow">Residente / Inicio</p><AccessNotice />
    <h1>{data?.residence.name ?? 'Mi residencia'}</h1>
    {loading && <p role="status">Cargando resumen…</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {data && <><p className="lead">{data.residence.street} · Tu residencia y tus próximas visitas.</p>
      {!data.canManage && <p className="access-notice">Tienes acceso de consulta. La gestión corresponde al principal de una residencia activa.</p>}
      <nav className="dashboard-actions resident-actions" aria-label="Acciones rápidas">
        {data.canManage && <Link className="button-link primary-invitation" to="/residente/invitaciones/nueva">Nueva invitación</Link>}
        {data.isPrincipal && <Link className="secondary-button" to="/residente/contactos">Contactos frecuentes</Link>}
        {data.canManage && <><Link className="secondary-button" to="/residente/mi-residencia?accion=vehiculo">Registrar vehículo</Link><Link className="secondary-button" to="/residente/mi-residencia?accion=habitante">Agregar habitante</Link><Link className="secondary-button" to="/residente/reportes/nuevo">Crear reporte</Link></>}
      </nav>
      <dl className="summary-strip dashboard-metrics resident-metrics">
        <div><dt>Invitaciones activas</dt><dd>{data.activeInvitationCount}</dd></div>
        <div><dt>Visitas recientes</dt><dd>{data.recentVisitCount}</dd></div>
        <div><dt>Habitantes</dt><dd>{data.inhabitantCount}</dd></div>
        <div><dt>Vehículos</dt><dd>{data.vehicleCount}</dd></div>
        <div><dt>Reportes pendientes</dt><dd>{data.pendingReportCount}</dd></div>
      </dl>
      <p className="form-help">Visitas recientes: entradas de los últimos 7 días, incluido hoy. Habitantes y vehículos permanentes: todos los registrados. Reportes pendientes: solo los tuyos. Invitaciones activas: incluye las programadas.</p>
      <div className="dashboard-links"><Link to="/residente/mi-residencia">Ver mi residencia</Link><Link to="/residente/invitaciones">Ver invitaciones</Link><Link to="/residente/reportes">Mis reportes</Link></div>
      <RecentAccess records={data.recentAccess} historyPath="/residente/historial" />
    </>}
  </section>
}
