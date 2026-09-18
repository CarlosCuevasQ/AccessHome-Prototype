import { useState } from 'react'
import { sharedMode } from '../../services/shared/provider'
import { copyInvitationLink, shareInvitationLink } from '../../services/invitationSharingService'
import { currentInvitationUrl, invitationWhatsAppUrl, isPublicOrigin } from '../../utils/invitationLinks'

export function InvitationShare({ token }: { token: string }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [manual, setManual] = useState(false)
  let url: string
  try { url = currentInvitationUrl(token) }
  catch (error) { return <p className="form-error" role="alert">{error instanceof Error ? error.message : 'Enlace no disponible.'}</p> }

  async function perform(action: 'share' | 'copy') {
    setBusy(true); setMessage(''); setManual(false)
    try {
      const result = await (action === 'share' ? shareInvitationLink(url) : copyInvitationLink(url))
      setManual(result === 'manual')
      setMessage({ shared: 'Se completó la acción de compartir.', copied: 'Enlace copiado.', manual: 'Selecciona y copia el enlace de abajo.', cancelled: 'Compartir cancelado.' }[result])
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo compartir. Prueba Copiar enlace.') }
    finally { setBusy(false) }
  }

  return <section className="invitation-share" aria-label="Compartir invitación">
    <h2>Compartir invitación</h2>
    {!sharedMode ? <p className="agenda-notice">Modo local: este enlace solo funciona con los datos de este navegador. Para invitar desde otros dispositivos utiliza el despliegue compartido.</p>
      : !isPublicOrigin(window.location.origin) && <p className="agenda-notice">Dirección de desarrollo: abre el despliegue público para generar un enlace utilizable desde otro dispositivo.</p>}
    <div className="share-actions">
      <button className="button-link" type="button" disabled={busy} onClick={() => { void perform('share') }}>Compartir invitación</button>
      <a className="secondary-button" href={invitationWhatsAppUrl(url)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Enviar por WhatsApp</a>
      <button className="secondary-button" type="button" disabled={busy} onClick={() => { void perform('copy') }}>Copiar enlace</button>
    </div>
    <p className="form-help">Si tu navegador no ofrece un menú para compartir, se intentará copiar el enlace. En WhatsApp eliges el destinatario y confirmas el envío.</p>
    {message && <p role="status">{message}</p>}
    {manual && <label className="form-field">Enlace de invitación<input readOnly value={url} onFocus={event => event.currentTarget.select()} /></label>}
    <p className="form-help">Compártelo solo con tu visitante: quien tenga el enlace podrá consultar esta invitación.</p>
  </section>
}
