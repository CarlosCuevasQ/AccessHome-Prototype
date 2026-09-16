import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import type { InvitationStatus } from '../types/invitations'
import { invitationsService } from '../services/invitationsService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { formatDate } from '../utils/dates'
import { InvitationStatusLabel, invitationStatusLabels } from '../components/invitations/InvitationStatusLabel'

export function InvitationsPage() {
  usePageTitle('Invitaciones')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<InvitationStatus | 'todas'>('todas')
  const load = useCallback(async () => ({ context: await invitationsService.getContext(), invitations: await invitationsService.listInvitations(search, status) }), [search, status])
  const { data, loading, error } = useCommunityQuery(load, 1000)
  return <section className="community-page invitations-page">
    <p className="eyebrow">Residente / Visitas</p>
    <div className="page-heading"><div><h1>Invitaciones</h1><p className="lead">Consulta las visitas de {data?.context.residenceName ?? 'tu residencia'}.</p></div>
      {data?.context.canManage && <Link className="button-link" to="/residente/invitaciones/nueva">Nuevo visitante</Link>}
    </div>
    {data?.context.canManage ? <p className="invitation-contact-link">¿Es un visitante habitual? <Link to="/residente/contactos">Invitar desde contactos frecuentes</Link></p> : data && <p className="access-notice">Puedes consultar las invitaciones. Solo el residente principal de una residencia activa puede crearlas o cancelarlas.</p>}
    <div className="invitation-filters">
      <label className="form-field">Buscar invitación<input type="search" placeholder="Nombre, teléfono o placas" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label className="form-field">Estado<select value={status} onChange={(event) => setStatus(event.target.value as InvitationStatus | 'todas')}><option value="todas">Todos los estados</option>{Object.entries(invitationStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && <p role="status">Cargando invitaciones…</p>}
    {data && <><p className="result-count" role="status">{data.invitations.length} {data.invitations.length === 1 ? 'invitación encontrada' : 'invitaciones encontradas'}</p>
      {data.invitations.length ? <ul className="invitation-list">{data.invitations.map((invitation) => <li key={invitation.id} className="invitation-row">
        <div className="invitation-summary"><h2>{invitation.visitorName}</h2><InvitationStatusLabel status={invitation.status} />
          <p>{invitation.vehicle ? `${[invitation.vehicle.brand, invitation.vehicle.model].filter(Boolean).join(' ') || 'Vehículo'} · ${invitation.vehicle.plates}` : 'Sin vehículo'}</p>
          <p>Del {formatDate(invitation.startsAt)} al {formatDate(invitation.expiresAt)}</p><p>{invitation.usedUses} de {invitation.maxUses} usos utilizados</p>
        </div>
        <Link className="secondary-button" to={`/residente/invitaciones/${invitation.id}`} aria-label={`Ver invitación de ${invitation.visitorName}`}>Ver detalle</Link>
      </li>)}</ul> : <p className="empty-list">{search || status !== 'todas' ? 'No hay invitaciones que coincidan con estos filtros.' : 'Todavía no hay invitaciones. Puedes invitar a un contacto o a un nuevo visitante.'}</p>}
    </>}
  </section>
}
