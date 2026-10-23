import { useCallback, useState } from 'react'
import { Skeleton } from '../components/Skeleton'
import { GuardStatusAction } from '../components/GuardStatusAction'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { guardManagementService } from '../services/guardManagementService'
import { formatDate } from '../utils/dates'

export function GuardManagementPage() {
  usePageTitle('Guardias')
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState('')
  const load = useCallback(() => guardManagementService.list(), [revision])
  const { data, error, loading } = useCommunityQuery(load, 30000)
  const activeCount = data?.filter((guard) => guard.active).length ?? 0
  return (
    <section className="community-page guard-management-page">
      <p className="eyebrow">Administración / Guardias</p>
      <div className="page-heading"><div><h1>Guardias</h1><p className="lead">Activa o desactiva el acceso a caseta del personal de tu condominio.</p></div>
        <button type="button" className="secondary-button" disabled={loading} onClick={() => { setNotice(''); setRevision((value) => value + 1) }}>Actualizar lista</button></div>
      <p className="form-help">Desactivar retira el acceso en la siguiente operación del guardia; su historial se conserva. El alta de cuentas y los bloqueos del responsable del sistema se gestionan fuera de esta pantalla: si el responsable bloqueó a un guardia, solo él puede reactivarlo.</p>
      {notice && <p className="form-success" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <Skeleton variant="list" label="Cargando guardias…" />}
      {data && <>
        <p className="result-count" role="status">{data.length} {data.length === 1 ? 'guardia' : 'guardias'} · {activeCount} {activeCount === 1 ? 'activo' : 'activos'}</p>
        {data.length ? <table className="data-table">
          <caption className="sr-only">Guardias del condominio</caption>
          <thead><tr><th scope="col">Guardia</th><th scope="col">Estado</th><th scope="col">Acceso a caseta</th></tr></thead>
          <tbody>{data.map((guard) => <tr key={guard.id}>
            <td data-label="Guardia">{guard.name}<span className="cell-secondary">Alta: {formatDate(guard.createdAt)}</span></td>
            <td data-label="Estado"><span className={`vehicle-status ${guard.active ? 'is-active' : ''}`}>{guard.active ? 'Activo' : 'Inactivo'}</span></td>
            <td data-label="Acceso a caseta"><GuardStatusAction key={`${guard.id}-${guard.active}`} guard={guard} onChanged={setNotice} /></td>
          </tr>)}</tbody>
        </table> : <p className="empty-list">No hay guardias en tu condominio. El responsable del sistema da de alta sus cuentas.</p>}
      </>}
    </section>
  )
}
