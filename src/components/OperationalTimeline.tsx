import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Disclosure } from './Disclosure'

export type TimelineKind = 'entry' | 'exit' | 'service' | 'rejected' | 'invitation' | 'completed'
export interface TimelineItem {
  key: string; occurredAt: string; kind: TimelineKind; label: string; name: string
  context?: string; secondary?: string; notice?: string; detail?: ReactNode
}
const icons: Record<TimelineKind, IconName> = { entry: 'entry', exit: 'exit', service: 'package', rejected: 'close', invitation: 'invitation', completed: 'check' }

export function OperationalTimeline({ items, timeZone, empty = 'Todavía no hay actividad.' }: { items: TimelineItem[]; timeZone?: string; empty?: string }) {
  const day = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone })
  const time = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone })
  if (!items.length) return <p className="empty-list">{empty}</p>
  return <ol className="operational-timeline">{items.map(item => <li className={`timeline-event timeline-${item.kind}`} key={item.key}>
    <time dateTime={item.occurredAt}><strong>{time.format(new Date(item.occurredAt))}</strong><span>{day.format(new Date(item.occurredAt))}</span></time>
    <span className="timeline-marker"><Icon name={icons[item.kind]} /></span>
    <div className="timeline-content">
      <span className="timeline-type">{item.label}</span><h3>{item.name}</h3>
      {item.context && <p className="timeline-context">{item.context}</p>}{item.secondary && <p className="timeline-secondary">{item.secondary}</p>}
      {item.notice && <p className="timeline-notice">{item.notice}</p>}
      {item.detail && <Disclosure title={`Detalles · ${item.label.toLocaleLowerCase('es')}`}>{item.detail}</Disclosure>}
    </div>
  </li>)}</ol>
}
