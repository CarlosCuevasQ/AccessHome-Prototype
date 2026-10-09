import { useCallback } from 'react'
import { OperationalTimeline } from '../OperationalTimeline'
import { serviceCategories } from '../../types/services'
import { Skeleton } from '../Skeleton'
import { Link } from 'react-router-dom'
import { serviceAccessService } from '../../services/serviceAccessService'
import { useCommunityQuery } from '../../hooks/useCommunityQuery'

export function ServiceSummary() {
  const load = useCallback(() => serviceAccessService.list('en_sitio'), [])
  const { data, error, loading } = useCommunityQuery(load, 30000)
  return <section className="service-presence"><h2>Servicios dentro</h2>
    {loading && <Skeleton variant="detail" label="Consultando servicios…" />}
    {data && <><div className="hero-number"><strong>{data.insideCount}</strong><span>en sitio</span></div>
      <dl className="inline-stats"><div><dt>Llegadas por decidir</dt><dd>{data.registeredCount}</dd></div></dl>
      <OperationalTimeline timeZone={data.timeZone} empty="No hay servicios dentro." items={data.records.slice(0, 3).map(visit => ({ key: visit.id, kind: 'service', label: 'En sitio', occurredAt: visit.events.find(event => event.operation === 'allow')?.occurredAt ?? visit.registeredAt, name: visit.company || serviceCategories[visit.category], context: visit.residenceName, secondary: visit.plates || visit.providerName }))} />
      {data.insideCount > 3 && <p className="form-help">Se muestran 3 servicios de {data.insideCount}.</p>}
    </>}
    {error && <p className="form-error" role="alert">No se pudieron consultar los servicios. Revisa tu conexión e intenta nuevamente.</p>}
    <Link className="text-button" to="/guardia/servicios">Consultar servicios</Link>
  </section>
}
