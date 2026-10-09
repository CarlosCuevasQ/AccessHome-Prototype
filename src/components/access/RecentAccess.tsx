import { ActionLink } from '../ActionLink'
import { Icon } from '../Icon'
import type { AccessRecord } from '../../types/access'
import type { GuardAccess } from '../../types/guard'
import { OperationalTimeline } from '../OperationalTimeline'
import { useId } from 'react'

export function RecentAccess({ records, historyPath, title = 'Actividad reciente', timeZone, empty = 'Aún no hay accesos registrados.', compactHeading = false }: {
  records: (AccessRecord | GuardAccess)[]; historyPath?: string; title?: string; timeZone?: string; empty?: string; compactHeading?: boolean
}) {
  const titleId = useId()
  return <section className="community-section" aria-labelledby={titleId}>
    <div className={compactHeading ? 'sr-only' : 'section-heading'}><h2 id={titleId}>{title}</h2>{historyPath && <ActionLink variant="ghost" to={historyPath} aria-label="Ver historial completo">Ver historial<Icon name="chevron" /></ActionLink>}</div>
    <OperationalTimeline timeZone={timeZone} empty={empty} items={records.map(record => ({
      key: record.id, occurredAt: record.occurredAt, kind: record.type === 'entrada' ? 'entry' : 'exit', label: record.type === 'entrada' ? 'Entrada' : 'Salida',
      name: record.visitorName, context: `${record.residenceName} · ${record.vehicle?.plates ?? 'Sin vehículo'}`,
      secondary: [record.method, 'validatorName' in record ? record.validatorName : null, 'inviterName' in record ? `Invita ${record.inviterName}` : null].filter(Boolean).join(' · '),
    }))} />
  </section>
}
