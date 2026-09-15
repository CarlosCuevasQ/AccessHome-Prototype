import { useState } from 'react'
import { Link } from 'react-router-dom'
import { communityService } from '../services/communityService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAuth } from '../hooks/useAuth'
import { CondominiumForm } from '../components/community/CondominiumForm'
import { AccessNotice } from '../components/AccessNotice'

export function CondominiumPage() {
  usePageTitle('Mi condominio')
  const { user } = useAuth()
  const { data, error, loading } = useCommunityQuery(communityService.getSummary)
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
        <dl className="summary-strip">
          <div><dt>Residencias</dt><dd>{data.residenceCount}</dd></div>
          <div><dt>Habitantes</dt><dd>{data.residentCount}</dd></div>
          <div><dt>Vehículos</dt><dd>{data.vehicleCount}</dd></div>
          <div><dt>Vehículos activos</dt><dd>{data.activeVehicleCount}</dd></div>
        </dl>
        <section className="community-section" aria-labelledby="condo-info">
          <div className="section-heading"><h2 id="condo-info">Información del condominio</h2><button className="text-button" onClick={() => { setEditing(true); setMessage('') }}>Editar información</button></div>
          {editing ? <CondominiumForm condominium={data.condominium} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); setMessage('Información del condominio actualizada.') }} /> : <p className="lead">{data.condominium.address}</p>}
        </section>
        <Link className="button-link" to="/admin/residencias">Ver residencias</Link>
      </>}
    </section>
  )
}
