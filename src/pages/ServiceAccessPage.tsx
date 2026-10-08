import { useCallback, useEffect, useRef, useState } from 'react'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { serviceAccessService } from '../services/serviceAccessService'
import { ServiceArrivalForm } from '../components/services/ServiceArrivalForm'
import { ServiceDecision } from '../components/services/ServiceDecision'
import { ServiceDetails } from '../components/services/ServiceDetails'
import { serviceCategories, serviceStates } from '../types/services'
import type { ServiceOperation, ServiceResult, ServiceState, ServiceVisit } from '../types/services'
import { formatDate } from '../utils/dates'

type Decision = Exclude<ServiceOperation, 'register'>
export function ServiceAccessPage({ administrative = false }: { administrative?: boolean }) {
  usePageTitle(administrative ? 'Historial de servicios' : 'Servicios y repartidores')
  const [filter, setFilter] = useState<ServiceState | 'todos'>(administrative ? 'todos' : 'registrado')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const load = useCallback(() => serviceAccessService.list(filter, page), [filter, page, revision])
  const { data, error, loading } = useCommunityQuery(load, 15000)
  const [selection, setSelection] = useState<{ visit: ServiceVisit; operation: Decision } | null>(null)
  const [receipt, setReceipt] = useState<ServiceResult | null>(null)
  const feedback = useRef<HTMLElement>(null)
  useEffect(() => { if (receipt) feedback.current?.focus() }, [receipt])
  const chooseFilter = (value: ServiceState | 'todos') => { setFilter(value); setPage(0) }
  function done(result: ServiceResult) { setSelection(null); setReceipt(result); setRevision(value => value + 1) }
  function actions(visit: ServiceVisit) {
    if (administrative) return null
    const options: Decision[] = visit.status === 'registrado' ? ['allow', 'reject', 'cancel'] : visit.status === 'en_sitio' ? ['exit'] : []
    const labels = { allow: 'Permitir entrada', reject: 'Rechazar acceso', cancel: 'Cancelar registro', exit: 'Registrar salida' }
    return <div className="form-actions">{options.map(operation => <button key={operation} className={operation === 'allow' || operation === 'exit' ? 'button-link' : 'secondary-button'} disabled={operation === 'allow' && visit.expired} onClick={() => { setReceipt(null); setSelection({ visit, operation }) }}>{labels[operation]}</button>)}</div>
  }
  return <section className="community-page guard-page service-page">
    <p className="eyebrow">{administrative ? 'Administrador / Servicios' : 'Guardia / Servicios'}</p>
    <h1>{administrative ? 'Historial de servicios' : 'Servicios y repartidores'}</h1>
    <p>{administrative ? 'Llegadas, decisiones y movimientos de servicios del condominio. Estos registros son independientes de las invitaciones residenciales.' : 'Registra la llegada, verifica presencialmente el servicio y decide su entrada. La operación corresponde a caseta.'}</p>
    {selection ? <ServiceDecision key={`${selection.visit.id}:${selection.operation}`} {...selection} zone={data?.timeZone ?? 'America/Mexico_City'} close={() => { setSelection(null); setRevision(value => value + 1) }} done={done} /> : <>
      {receipt && <section ref={feedback} tabIndex={-1} className={`service-receipt service-${receipt.record.status}`} aria-label="Resultado de la operación">
        <p role="status">{receipt.replayed ? 'Operación ya registrada. No se autoriza repetir el paso; se muestra el estado actual.' : receipt.record.status === 'registrado' ? 'Llegada registrada. Todavía no hay una entrada.' : `Operación registrada: ${serviceStates[receipt.record.status]}.`}</p>
        <ServiceDetails visit={receipt.record} zone={data?.timeZone} />{actions(receipt.record)}
        <button className="secondary-button" onClick={() => setReceipt(null)}>Cerrar resultado</button>
      </section>}
      {!administrative && !receipt && <ServiceArrivalForm onRegistered={result => { chooseFilter('registrado'); done(result) }} />}
      {!administrative && <nav className="scanner-actions" aria-label="Colas de servicios"><button className="secondary-button" onClick={() => chooseFilter('registrado')}>Pendientes de decisión{data && ` (${data.registeredCount})`}</button><button className="secondary-button" onClick={() => chooseFilter('en_sitio')}>Servicios dentro del condominio{data && ` (${data.insideCount})`}</button></nav>}
      <div className="guard-updates"><label>Estado del servicio<select value={filter} onChange={e => chooseFilter(e.target.value as ServiceState | 'todos')}><option value="todos">Todos</option>{Object.entries(serviceStates).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="secondary-button" disabled={loading} onClick={() => setRevision(value => value + 1)}>Actualizar servicios</button></div>
      <h2>{filter === 'en_sitio' ? 'Servicios dentro del condominio' : filter === 'registrado' ? 'Llegadas pendientes de decisión' : 'Registros de servicios'}</h2>
      <p className="form-help">Actualización cada 15 segundos mientras esta pantalla esté visible.{data && ` Horarios: ${data.timeZone}.`}</p>
      {loading && <p role="status">Consultando servicios…</p>}{error && <p className="form-error" role="alert">{error}</p>}
      {data && <>
        {!data.records.length && <p>No hay servicios en esta página.</p>}
        <ul className="service-list">{data.records.map(visit => <li key={visit.id}>
          <h3>{visit.company || serviceCategories[visit.category]} · {visit.residenceName}</h3>
          <p>{serviceCategories[visit.category]} · <span className={`service-state service-${visit.status}`}>{serviceStates[visit.status]}</span>{visit.expired && visit.status === 'registrado' && ' · Vigencia vencida, sin entrada'}</p>
          {(visit.providerName || visit.plates) && <p>{[visit.providerName, visit.plates].filter(Boolean).join(' · ')}</p>}
          <p>Llegada: {formatDate(visit.registeredAt, data.timeZone)} · {visit.events.find(event => event.operation === 'register')?.actorName}</p>
          {visit.events.filter(event => ['allow', 'exit', 'reject'].includes(event.operation)).map(event => <p key={event.id}><strong>{event.operation === 'allow' ? 'Entrada' : event.operation === 'exit' ? 'Salida' : 'Rechazo'}:</strong> {formatDate(event.occurredAt, data.timeZone)} · {event.actorName}</p>)}
          <details><summary>Ver registro completo</summary><ServiceDetails visit={visit} zone={data.timeZone} /></details>
          {actions(visit)}
        </li>)}</ul>
        <nav className="guard-pagination" aria-label="Páginas de servicios"><button className="secondary-button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page + 1}</span><button className="secondary-button" disabled={!data.hasMore} onClick={() => setPage(value => value + 1)}>Siguiente</button></nav>
      </>}
    </>}
  </section>
}
