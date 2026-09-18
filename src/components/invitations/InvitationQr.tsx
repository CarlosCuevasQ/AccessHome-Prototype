import { QRCodeSVG } from 'qrcode.react'
import type { InvitationStatus } from '../../types/invitations'
import { currentInvitationUrl } from '../../utils/invitationLinks'
import { invitationQrPurpose } from '../../services/invitationQrPurpose'

export function InvitationQr({ token, visitorName, status, hasOpenEntry = false }: { token: string; visitorName: string; status: InvitationStatus; hasOpenEntry?: boolean }) {
  const purpose = invitationQrPurpose(status, hasOpenEntry)
  if (purpose === 'unavailable') return <p className="access-notice">El QR no está disponible: esta invitación ya no permite accesos.</p>
  let url: string
  try { url = currentInvitationUrl(token) }
  catch (error) { return <p className="form-error" role="alert">{error instanceof Error ? error.message : 'QR no disponible.'}</p> }
  return <figure className="invitation-qr">
    {purpose === 'exit' && <p className="access-notice"><strong>Código válido únicamente para salida</strong></p>}
    <QRCodeSVG
      value={url}
      size={288} level="M" marginSize={4}
      bgColor="#FFFFFF" fgColor="#17212B"
      role="img" title={`QR de la invitación de ${visitorName}`}
    />
    <figcaption>{purpose === 'exit' ? 'Presenta este QR en caseta para cerrar tu visita. No permite una nueva entrada. El guardia verificará la salida.' : 'Presenta este código en caseta durante su vigencia. El personal verificará el estado antes de autorizar el acceso.'}</figcaption>
  </figure>
}
