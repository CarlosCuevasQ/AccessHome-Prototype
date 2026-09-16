import type { AccessRecord } from '../../types/access'
import { formatDate } from '../../utils/dates'

export function AccessHistory({ records }: { records: AccessRecord[] }) {
  return <section className="community-section" aria-labelledby="access-history-title">
    <div className="section-heading"><h2 id="access-history-title">Movimientos autorizados</h2><span className="count-label">{records.length} {records.length === 1 ? 'registro' : 'registros'}</span></div>
    {records.length ? <table className="data-table">
      <caption className="sr-only">Registro de entradas y salidas del condominio</caption>
      <thead><tr><th>Fecha y hora</th><th>Visita</th><th>Movimiento</th><th>Vehículo</th><th>Método</th></tr></thead>
      <tbody>{records.map((record) => <tr key={record.id}>
        <td data-label="Fecha y hora">{formatDate(record.occurredAt)}</td>
        <td data-label="Visita">{record.visitorName}<span className="cell-secondary">{record.residenceName} · Anfitrión: {record.inviterName}</span></td>
        <td data-label="Movimiento">{record.type === 'entrada' ? 'Entrada' : 'Salida'}</td>
        <td data-label="Vehículo">{record.vehicle?.plates ?? 'Sin vehículo'}{record.vehicle && <span className="cell-secondary">{[record.vehicle.brand, record.vehicle.model, record.vehicle.color].filter(Boolean).join(' · ') || 'Sin datos adicionales'}</span>}</td>
        <td data-label="Método">{record.method}</td>
      </tr>)}</tbody>
    </table> : <p className="empty-list">Todavía no se han autorizado entradas o salidas.</p>}
  </section>
}
