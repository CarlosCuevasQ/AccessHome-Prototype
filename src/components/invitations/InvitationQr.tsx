import { QRCodeSVG } from 'qrcode.react'
import type { InvitationStatus } from '../../types/invitations'
import { invitationUrl } from '../../utils/invitationLinks'

export function InvitationQr({ token, visitorName, status }: { token: string; visitorName: string; status: InvitationStatus }) {
  return <figure className="invitation-qr">
    <QRCodeSVG
      value={invitationUrl(token, window.location.origin)}
      size={288} level="M" marginSize={4}
      bgColor="#FFFFFF" fgColor="#17212B"
      role="img" title={`QR de la invitación de ${visitorName}`}
    />
    <figcaption>{status === 'activa' ? 'Presenta este código en el acceso durante su vigencia.' : 'Código conservado para consultar la invitación. Ya no permite accesos.'}</figcaption>
  </figure>
}
