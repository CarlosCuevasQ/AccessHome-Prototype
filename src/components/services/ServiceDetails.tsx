import { serviceCategories, serviceOperations, serviceStates } from '../../types/services'
import type { ServiceVisit } from '../../types/services'
import { formatDate } from '../../utils/dates'

export function ServiceDetails({ visit, zone }: { visit: ServiceVisit; zone?: string }) {
  return <>
    <h3>{visit.company || serviceCategories[visit.category]} · {visit.residenceName}</h3>
    <p>{serviceCategories[visit.category]} · <span className={`service-state service-${visit.status}`}>{serviceStates[visit.status]}</span></p>
    {visit.providerName && <p>Prestador: {visit.providerName}</p>}
    {visit.plates && <p>Placas: {visit.plates}</p>}
    {visit.notes && <p>Observaciones: {visit.notes}</p>}
    {visit.status === 'registrado' && <p className="access-notice">{visit.expired ? 'Vigencia vencida. No permite entrada.' : `Entrada disponible hasta ${formatDate(visit.expiresAt, zone)}. Todavía no ha ingresado.`}</p>}
    <ol className="service-timeline" aria-label="Registro del servicio">{visit.events.map(event => <li key={event.id}>
      <strong>{serviceOperations[event.operation]}</strong> · {formatDate(event.occurredAt, zone)}<br />
      Guardia: {event.actorName}{event.method && ' · Método manual'}{event.reason && <p>Motivo: {event.reason}</p>}
    </li>)}</ol>
  </>
}
