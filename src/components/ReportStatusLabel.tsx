import { reportStatusLabels } from '../types/reports'
import type { ReportStatus } from '../types/reports'

export function ReportStatusLabel({ status }: { status: ReportStatus }) {
  return <span className={`report-status report-${status}`}>{reportStatusLabels[status]}</span>
}
