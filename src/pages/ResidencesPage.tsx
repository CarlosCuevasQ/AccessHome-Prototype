import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { communityService } from '../services/communityService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { ResidenceForm } from '../components/community/ResidenceForm'

export function ResidencesPage() {
  usePageTitle('Residencias')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
  const load = useCallback(() => communityService.listResidences(search), [search])
  const { data, error, loading } = useCommunityQuery(load)
  return (
    <section className="community-page">
      <p className="eyebrow">Administración / Residencias</p>
      <div className="page-heading"><div><h1>Residencias</h1><p className="lead">Personas y vehículos organizados por casa.</p></div><button className="button-link" onClick={() => { setCreating(true); setMessage('') }}>Agregar residencia</button></div>
      {message && <p className="form-success" role="status">{message}</p>}
      {creating && <ResidenceForm onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); setSearch(''); setMessage('Residencia creada. Abre su detalle para asignar al residente principal.') }} />}
      <label className="form-field search-field">Buscar por número de casa<input type="search" placeholder="Ej. 24" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p role="status">Cargando residencias…</p>}
      {data && <>
        <p className="result-count" role="status">{data.length} {data.length === 1 ? 'residencia encontrada' : 'residencias encontradas'}</p>
        {data.length ? <table className="data-table">
          <caption className="sr-only">Residencias del condominio</caption>
          <thead><tr><th scope="col">Residencia</th><th scope="col">Calle o circuito</th><th scope="col">Residente principal</th><th scope="col">Habitantes</th><th scope="col">Vehículos</th></tr></thead>
          <tbody>{data.map((house) => <tr key={house.id}>
            <td data-label="Residencia"><Link to={`/admin/residencias/${house.id}`}>{house.name}</Link><span className="cell-secondary">{house.active ? 'Activa' : 'Inactiva'}</span></td><td data-label="Calle">{house.street}</td><td data-label="Principal">{house.principalName ?? 'Sin asignar'}</td><td data-label="Habitantes">{house.residentCount}</td><td data-label="Vehículos">{house.vehicleCount}</td>
          </tr>)}</tbody>
        </table> : <p className="empty-list">No hay residencias que coincidan con la búsqueda.</p>}
      </>}
    </section>
  )
}
