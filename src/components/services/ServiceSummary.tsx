import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { serviceAccessService } from '../../services/serviceAccessService'
import { useCommunityQuery } from '../../hooks/useCommunityQuery'

export function ServiceSummary() {
  const load = useCallback(() => serviceAccessService.list('en_sitio'), [])
  const { data, error } = useCommunityQuery(load, 30000)
  return <section className="community-section"><h2>Servicios</h2>
    {data && <p>{data.registeredCount} llegadas pendientes de decisión · {data.insideCount} servicios dentro del condominio.</p>}
    {error && <p className="form-error" role="alert">No se pudieron consultar los servicios. Comprueba la conexión y la migración de servicios.</p>}
    <Link to="/guardia/servicios">Registrar y consultar servicios</Link>
  </section>
}
