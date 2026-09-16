import type { InvitationStatus } from '../../types/invitations'

export const invitationStatusLabels: Record<InvitationStatus, string> = {
  activa: 'Activa', completada: 'Completada', cancelada: 'Cancelada', expirada: 'Expirada',
}

export function InvitationStatusLabel({ status }: { status: InvitationStatus }) {
  return <span className={`invitation-status invitation-status-${status}`}>{invitationStatusLabels[status]}</span>
}
