import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AccessHistoryFilters } from '../types/access'
import { guardService } from '../services/guardService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { AccessHistory } from '../components/access/AccessHistory'

export function GuardHistoryPage() {
  usePageTitle('Historial de caseta')
  const [movement, setMovement] = useState<AccessHistoryFilters['type']>('')
  const [page, setPage] = useState(0)
  const load = useCallback(() => guardService.getHistory(movement, page), [movement, page])
  const { data, error, loading } = useCommunityQuery(load, 30000)
  return <section className="community-page guard-page">
    <p className="eyebrow">Guardia / Historial</p><h1>Historial de caseta</h1>
    <p className="lead">Movimientos del condominio en los últimos 7 días, incluido hoy. Consulta de hasta 50 registros por página.</p>
    <label className="form-field guard-filter">Movimiento<select value={movement} onChange={event => { setMovement(event.target.value as AccessHistoryFilters['type']); setPage(0) }}>
      <option value="">Entradas y salidas</option><option value="entrada">Entradas</option><option value="salida">Salidas</option>
    </select></label>
    {loading && <p role="status">Cargando historial…</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {data && <><p className="form-help">Fechas en la zona horaria del condominio: {data.timeZone}.</p>
      <AccessHistory records={data.records} filtered={Boolean(movement) || page > 0} timeZone={data.timeZone} operational />
      <nav className="guard-pagination" aria-label="Páginas del historial">
        <button className="secondary-button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anterior</button>
        <span>Página {page + 1}</span><button className="secondary-button" disabled={!data.hasMore} onClick={() => setPage(value => value + 1)}>Siguiente</button>
      </nav></>}
    <Link to="/guardia">Volver a caseta</Link>
  </section>
}
