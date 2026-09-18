import { QRCodeSVG } from 'qrcode.react'
import type { InvitationStatus } from '../../types/invitations'
import { currentInvitationUrl } from '../../utils/invitationLinks'

export function InvitationQr({ token, visitorName, status }: { token: string; visitorName: string; status: InvitationStatus }) {
  if (status !== 'activa') return <p className="access-notice">El QR no está disponible: esta invitación ya no permite accesos.</p>
  let url: string
  try { url = currentInvitationUrl(token) }
  catch (error) { return <p className="form-error" role="alert">{error instanceof Error ? error.message : 'QR no disponible.'}</p> }
  return <figure className="invitation-qr">
    <QRCodeSVG
      value={url}
      size={288} level="M" marginSize={4}
      bgColor="#FFFFFF" fgColor="#17212B"
      role="img" title={`QR de la invitación de ${visitorName}`}
    />
    <figcaption>Presenta este código en caseta durante su vigencia. El personal verificará el estado antes de autorizar el acceso.</figcaption>
  </figure>
}
