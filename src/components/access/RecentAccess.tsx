import { Link } from 'react-router-dom'
import type { AccessRecord } from '../../types/access'
import { formatDate } from '../../utils/dates'

export function RecentAccess({ records, historyPath }: { records: AccessRecord[]; historyPath: string }) {
  return <section className="community-section" aria-labelledby="recent-activity-title">
    <div className="section-heading"><h2 id="recent-activity-title">Actividad reciente</h2><Link to={historyPath}>Ver historial completo</Link></div>
    {records.length ? <ul className="activity-list">{records.map((record) => <li key={record.id}>
      <div><strong>{record.visitorName}</strong><span className="cell-secondary">{record.residenceName} · {record.inviterName}</span><span className="cell-secondary">{record.vehicle?.plates ?? 'Sin vehículo'}</span></div>
      <div><span>{record.type === 'entrada' ? 'Entrada' : 'Salida'}</span><time className="cell-secondary" dateTime={record.occurredAt}>{formatDate(record.occurredAt)}</time></div>
    </li>)}</ul> : <p className="empty-list">Aún no hay accesos registrados.</p>}
  </section>
}
