import { useCallback } from 'react'
import { ActionLink } from './ActionLink'
import { invitationsService } from '../services/invitationsService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { formatDate } from '../utils/dates'
import { Skeleton } from './Skeleton'
import { Icon } from './Icon'

export function UpcomingInvitations() {
  const load = useCallback(() => invitationsService.listInvitations('', 'activa'), [])
  const { data, loading, error } = useCommunityQuery(load, 10000)
  // Presentation only: use the service's authoritative status, never authorize from this card.
  const upcoming = data?.filter(invitation => invitation.usedUses === 0).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 2)
  return <section className="upcoming-module" aria-labelledby="upcoming-title">
    <div className="section-heading"><h2 id="upcoming-title">Próximas visitas</h2><ActionLink variant="ghost" to="/residente/invitaciones">Ver todas<Icon name="chevron" /></ActionLink></div>
    {loading && <Skeleton variant="detail" label="Consultando próximas visitas…" />}
    {error && <p className="form-error" role="alert">{error}</p>}
    {upcoming && (upcoming.length ? <ul className="upcoming-list">{upcoming.map((item, index) => <li key={item.id} className={index === 0 ? 'upcoming-feature' : 'upcoming-compact'}>
      <div className="invitation-symbol"><Icon name="invitation" /></div>
      <div><span className="timeline-type">Invitación activa · Sin entrada</span><h3>{item.visitorName}</h3>
        <p>Desde {formatDate(item.startsAt)}</p><p className="muted">Hasta {formatDate(item.expiresAt)}</p>
        <p>{item.vehicle?.plates || 'Sin vehículo'}</p>
      </div><ActionLink variant="detail" to={`/residente/invitaciones/${item.id}`}>Ver invitación<span className="sr-only"> de {item.visitorName}</span></ActionLink>
    </li>)}</ul> : <div className="quiet-empty"><Icon name="invitation" /><h3>Sin visitas por llegar</h3><p>Las invitaciones activas sin entrada aparecerán aquí.</p></div>)}
    <p className="form-help">Ordenadas por inicio de vigencia. Horarios de este dispositivo.</p>
  </section>
}
