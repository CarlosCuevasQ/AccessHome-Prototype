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
    <section className="community-page">
      <p className="eyebrow">Administración / Condominio</p>
      <AccessNotice />
      <h1>{data?.condominium.name ?? 'Mi condominio'}</h1>
      <p className="lead">Bienvenido, {user?.name}. Consulta y organiza las residencias de tu comunidad.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      {loading && <p role="status">Cargando condominio…</p>}
      {message && <p role="status" className="form-success">{message}</p>}
      {data && <>
        <dl className="summary-strip dashboard-metrics">
          <div><dt>Residencias</dt><dd>{data.residenceCount}</dd></div>
          <div><dt>Habitantes activos</dt><dd>{data.activeInhabitantCount}</dd></div>
          <div><dt>Vehículos registrados</dt><dd>{data.vehicleCount}</dd></div>
          <div><dt>Accesos de hoy</dt><dd>{data.todayAccessCount}</dd></div>
          <div><dt>Invitaciones activas</dt><dd>{data.activeInvitationCount}</dd></div>
          <div><dt>Reportes pendientes</dt><dd>{data.pendingReportCount}</dd></div>
        </dl>
        <p className="form-help">Accesos de hoy: entradas y salidas autorizadas en el día local. Vehículos: registros permanentes, activos e inactivos. Invitaciones activas: incluye las programadas.</p>
        <nav className="dashboard-actions" aria-label="Acciones del administrador"><Link className="button-link" to="/admin/control-acceso">Control de acceso</Link><Link className="secondary-button" to="/admin/residencias">Ver residencias</Link><Link className="secondary-button" to="/admin/reportes">Revisar reportes</Link></nav>
        <RecentAccess records={data.recentAccess} historyPath="/admin/historial" />
        <section className="community-section" aria-labelledby="condo-info">
          <div className="section-heading"><h2 id="condo-info">Información del condominio</h2><button className="text-button" onClick={() => { setEditing(true); setMessage('') }}>Editar información</button></div>
          {editing ? <CondominiumForm condominium={data.condominium} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); setMessage('Información del condominio actualizada.') }} /> : <p className="lead">{data.condominium.address}</p>}
        </section>
      </>}
    </section>
  )
}
