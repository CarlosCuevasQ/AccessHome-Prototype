import { useCallback, useState } from 'react'
import type { AccessHistoryFilters } from '../types/access'
import { accessHistoryService } from '../services/accessHistoryService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { AccessHistory } from '../components/access/AccessHistory'

export function AccessHistoryPage() {
  usePageTitle('Historial de accesos')
  const [filters, setFilters] = useState<AccessHistoryFilters>({})
  const context = useCommunityQuery(accessHistoryService.getContext)
  const load = useCallback(() => accessHistoryService.listRecords(filters), [filters])
  const { data, error, loading } = useCommunityQuery(load)
  const update = (key: keyof AccessHistoryFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }))
  return <section className="community-page">
    <p className="eyebrow">Registro de visitas</p><h1>Historial de accesos</h1>
    <p className="lead">{context.data?.administrative ? 'Entradas y salidas del condominio.' : `Movimientos de ${context.data?.residences[0]?.name ?? 'tu residencia'} y sus invitaciones.`}</p>
    <div className="history-filters">
      <label className="form-field">Buscar acceso<input type="search" placeholder="Visitante, casa, anfitrión o placas" value={filters.search ?? ''} onChange={(event) => update('search', event.target.value)} /></label>
      {context.data?.administrative && <label className="form-field">Residencia<select value={filters.residenceId ?? ''} onChange={(event) => update('residenceId', event.target.value)}><option value="">Todas las residencias</option>{context.data.residences.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select></label>}
      <label className="form-field">Movimiento<select value={filters.type ?? ''} onChange={(event) => update('type', event.target.value)}><option value="">Entrada y salida</option><option value="entrada">Entrada</option><option value="salida">Salida</option></select></label>
      <label className="form-field">Desde<input type="date" value={filters.from ?? ''} onInput={(event) => update('from', event.currentTarget.value)} /></label>
      <label className="form-field">Hasta<input type="date" value={filters.to ?? ''} onInput={(event) => update('to', event.currentTarget.value)} /></label>
      <button className="secondary-button" onClick={() => setFilters({})}>Limpiar filtros</button>
    </div>
    <p className="form-help">Fechas en la hora local del dispositivo; ambos días incluidos. Los intentos rechazados no generan movimientos.</p>
    {(error || context.error) && <p className="form-error" role="alert">{error || context.error}</p>}
    {loading && <p role="status">Cargando historial…</p>}
    {data && <AccessHistory records={data} filtered={Object.values(filters).some(Boolean)} />}
  </section>
}
