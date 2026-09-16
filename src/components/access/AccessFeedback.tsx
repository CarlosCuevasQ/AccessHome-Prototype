import type { AccessResult } from '../../types/access'
import { formatDate } from '../../utils/dates'

export function AccessFeedback({ result }: { result: AccessResult }) {
  return <section className={`access-result ${result.authorized ? 'access-authorized' : 'access-rejected'}`} role="status" aria-live="polite" aria-atomic="true">
    <h2>{result.authorized ? 'Acceso autorizado' : 'Acceso rechazado'}</h2>
    {result.authorized ? <>
      <p className="access-movement">{result.record.type === 'entrada' ? 'ENTRADA' : 'SALIDA'}</p>
      <p><strong>{result.record.visitorName}</strong> · {result.record.residenceName}</p>
      <p>Anfitrión: {result.record.inviterName}</p>
      <p>{result.record.vehicle ? `${[result.record.vehicle.brand, result.record.vehicle.model].filter(Boolean).join(' ') || 'Vehículo'} · ${result.record.vehicle.plates}` : 'Sin vehículo'}</p>
      <p>{formatDate(result.record.occurredAt)} · Método QR</p>
      <p>{result.usedUses} de {result.maxUses} usos utilizados. {result.status === 'completada' ? 'Invitación completada.' : 'La siguiente validación registrará la salida.'}</p>
    </> : <p>{result.message}</p>}
  </section>
}
