import type { AccessRecord } from '../../types/access'
import { formatDate } from '../../utils/dates'
import { useId } from 'react'

export function AccessHistory({ records, filtered = false }: { records: AccessRecord[]; filtered?: boolean }) {
  const titleId = useId()
  return <section className="community-section" aria-labelledby={titleId}>
    <div className="section-heading"><h2 id={titleId}>Movimientos autorizados</h2><span className="count-label" role="status">{records.length} {records.length === 1 ? 'registro' : 'registros'}</span></div>
    {records.length ? <table className="data-table">
      <caption className="sr-only">Historial de entradas y salidas</caption>
      <thead><tr><th>Fecha y hora</th><th>Visita / Casa / Anfitrión</th><th>Movimiento</th><th>Vehículo</th><th>Método</th><th>Estado</th></tr></thead>
      <tbody>{records.map((record) => <tr key={record.id}>
        <td data-label="Fecha y hora">{formatDate(record.occurredAt)}</td>
        <td data-label="Visita">{record.visitorName}<span className="cell-secondary">{record.residenceName} · Anfitrión: {record.inviterName}</span></td>
        <td data-label="Movimiento">{record.type === 'entrada' ? 'Entrada' : 'Salida'}</td>
        <td data-label="Vehículo">{record.vehicle?.plates ?? 'Sin vehículo'}{record.vehicle && <span className="cell-secondary">{[record.vehicle.brand, record.vehicle.model, record.vehicle.color].filter(Boolean).join(' · ') || 'Sin datos adicionales'}</span>}</td>
        <td data-label="Método">{record.method}</td>
        <td data-label="Estado"><span className="vehicle-status is-active">Autorizado</span></td>
      </tr>)}</tbody>
    </table> : <p className="empty-list">{filtered ? 'No hay movimientos que coincidan con estos filtros.' : 'Todavía no se han autorizado entradas o salidas.'}</p>}
  </section>
}
