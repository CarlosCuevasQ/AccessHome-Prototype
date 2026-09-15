import { Link, Outlet } from 'react-router-dom'
import { contactsService } from '../services/contactsService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'

export function PrincipalRoute() {
  const { data, loading, error } = useCommunityQuery(contactsService.getAccess)
  if (loading) return <p role="status">Cargando agenda…</p>
  if (error) return <section><h1>Agenda no disponible</h1><p className="form-error" role="alert">{error}</p><Link to="/residente">Volver a mi residencia</Link></section>
  return <Outlet context={data} />
}
