import { Skeleton } from '../components/Skeleton'
import { useCallback, useState } from 'react'
import { ActionLink } from '../components/ActionLink'
import { Icon } from '../components/Icon'
import { FadeContent } from '../components/react-bits/FadeContent'
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
  return <section className="community-page invitations-page resident-experience resident-invitations">
    <p className="eyebrow">Residente / Visitas</p>
    <FadeContent className="page-heading"><div><h1>Invitaciones</h1><p className="lead">Las visitas de {data?.context.residenceName ?? 'tu residencia'}, en un solo lugar.</p></div>
      {data?.context.canManage && <ActionLink variant="primary" icon="plus" to="/residente/invitaciones/nueva">Nueva invitación</ActionLink>}
    </FadeContent>
    {data?.context.canManage ? <div className="contact-shortcut"><Icon name="people" /><div><strong>¿Alguien que ya conoces?</strong><span>Reutiliza sus datos al invitar.</span></div><ActionLink variant="ghost" to="/residente/contactos">Contactos frecuentes<Icon name="chevron" /></ActionLink></div> : data && <p className="access-notice">Puedes consultar las invitaciones. Solo el residente principal de una residencia activa puede crearlas o cancelarlas.</p>}
    <div className="invitation-filters">
      <label className="form-field">Buscar invitación<input type="search" placeholder="Nombre, teléfono o placas" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label className="form-field">Estado<select value={status} onChange={(event) => setStatus(event.target.value as InvitationStatus | 'todas')}><option value="todas">Todos los estados</option>{Object.entries(invitationStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && <Skeleton variant="list" label="Cargando invitaciones…" />}
    {data && <><p className="result-count" role="status">{data.invitations.length} {data.invitations.length === 1 ? 'invitación encontrada' : 'invitaciones encontradas'}</p>
      {data.invitations.length ? <ul className="invitation-list">{data.invitations.map((invitation) => <li key={invitation.id} className="invitation-row">
        <div className="entity-symbol"><Icon name="invitation" /></div>
        <div className="invitation-summary"><div className="invitation-row-title"><h2>{invitation.visitorName}</h2><InvitationStatusLabel status={invitation.status} /></div>
          <dl className="invitation-period"><div><dt>Inicio</dt><dd>{formatDate(invitation.startsAt)}</dd></div><div><dt>Vence</dt><dd>{formatDate(invitation.expiresAt)}</dd></div></dl>
          <p className="invitation-row-context"><Icon name="car" />{invitation.vehicle ? `${[invitation.vehicle.brand, invitation.vehicle.model].filter(Boolean).join(' ') || 'Vehículo'} · ${invitation.vehicle.plates}` : 'Sin vehículo'}<span>{invitation.usedUses} de {invitation.maxUses} usos</span></p>
        </div>
        <ActionLink variant="detail" to={`/residente/invitaciones/${invitation.id}`} aria-label={`Ver invitación de ${invitation.visitorName}`}>Ver detalle</ActionLink>
      </li>)}</ul> : <p className="empty-list">{search || status !== 'todas' ? 'No hay invitaciones que coincidan con estos filtros.' : 'Todavía no hay invitaciones. Puedes invitar a un contacto o a un nuevo visitante.'}</p>}
    </>}
  </section>
}
