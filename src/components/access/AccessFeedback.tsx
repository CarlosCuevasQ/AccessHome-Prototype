import type { AccessResult } from '../../types/access'
import type { GuardScanResult } from '../../types/guard'
import { formatDate } from '../../utils/dates'
import { invitationStatusLabels } from '../invitations/InvitationStatusLabel'

export function AccessFeedback({ result, operational = false }: { result: AccessResult | GuardScanResult; operational?: boolean }) {
  const warning = result.authorized ? result.replayed : ['concurrent_scan', 'recent_scan'].includes(result.reason)
  return <section className={`access-result ${warning ? 'access-warning' : result.authorized ? 'access-authorized' : 'access-rejected'}`} role="status" aria-live="polite" aria-atomic="true">
    <h2>{warning ? result.authorized ? 'Movimiento ya registrado' : 'Lectura sin nuevo movimiento' : result.authorized ? 'Acceso autorizado' : 'Acceso rechazado'}</h2>
    {result.authorized ? <>
      <p className="access-movement">{result.record.type === 'entrada' ? 'ENTRADA' : 'SALIDA'}</p>
      <p><strong>{result.record.visitorName}</strong> · {result.record.residenceName}</p>
      {!operational && 'inviterName' in result.record && <p>Anfitrión: {result.record.inviterName}</p>}
      <p>{result.record.vehicle ? `${[result.record.vehicle.brand, result.record.vehicle.model, result.record.vehicle.color].filter(Boolean).join(' · ') || 'Vehículo'} · ${result.record.vehicle.plates}` : 'Sin vehículo'}</p>
      <p>{formatDate(result.record.occurredAt)} · Método {result.record.method === 'MANUAL' ? 'manual' : 'QR'}</p>
      {result.record.validatorName && <p>Registrado por: {result.record.validatorName}</p>}
      {result.record.type === 'salida' && result.record.invitationEffectiveStatusBefore && result.record.invitationEffectiveStatusBefore !== 'activa' && <p>Estado previo: {invitationStatusLabels[result.record.invitationEffectiveStatusBefore]}. Se cerró una visita con entrada registrada; no se habilitó una nueva entrada.</p>}
      {result.replayed && <p>Respuesta recuperada de la misma operación. No se creó otro movimiento ni se autoriza un nuevo paso; verifica el historial.</p>}
      <p>{result.usedUses} de {result.maxUses} usos utilizados. {result.status === 'completada' ? 'Invitación completada.' : 'La siguiente validación registrará la salida.'}</p>
    </> : <p>{result.message}</p>}
  </section>
}
