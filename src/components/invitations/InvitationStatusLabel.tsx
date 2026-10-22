import type { InvitationStatus } from '../../types/invitations'

export const invitationStatusLabels: Record<InvitationStatus, string> = {
  activa: 'Activa', completada: 'Completada', cancelada: 'Cancelada', expirada: 'Expirada',
}

// entryUnavailable: an otherwise active invitation whose house is inactive.
export function InvitationStatusLabel({ status, entryUnavailable = false }: { status: InvitationStatus; entryUnavailable?: boolean }) {
  if (entryUnavailable) return <span className="invitation-status">No disponible</span>
  return <span className={`invitation-status invitation-status-${status}`}>{invitationStatusLabels[status]}</span>
}
