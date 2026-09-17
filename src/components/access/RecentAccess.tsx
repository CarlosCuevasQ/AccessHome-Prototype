import { Link } from 'react-router-dom'
import type { AccessRecord } from '../../types/access'
import type { GuardAccess } from '../../types/guard'
import { formatDate } from '../../utils/dates'
import { useId } from 'react'

export function RecentAccess({ records, historyPath, title = 'Actividad reciente', timeZone, empty = 'Aún no hay accesos registrados.' }: {
  records: (AccessRecord | GuardAccess)[]; historyPath?: string; title?: string; timeZone?: string; empty?: string
}) {
  const titleId = useId()
  return <section className="community-section" aria-labelledby={titleId}>
    <div className="section-heading"><h2 id={titleId}>{title}</h2>{historyPath && <Link to={historyPath}>Ver historial completo</Link>}</div>
    {records.length ? <ul className="activity-list">{records.map((record) => <li key={record.id}>
      <div><strong>{record.visitorName}</strong><span className="cell-secondary">{record.residenceName}{'inviterName' in record && ` · ${record.inviterName}`}</span><span className="cell-secondary">{record.vehicle?.plates ?? 'Sin vehículo'}</span></div>
      <div><span>{record.type === 'entrada' ? 'Entrada' : 'Salida'}</span><time className="cell-secondary" dateTime={record.occurredAt}>{formatDate(record.occurredAt, timeZone)}</time></div>
    </li>)}</ul> : <p className="empty-list">{empty}</p>}
  </section>
}
