import { Icon } from './Icon'
import { FadeContent } from './react-bits/FadeContent'

/** Decorative product illustration. No encoded token, real QR or live resident data. */
export function LoginPhone() {
  return <FadeContent className="phone-stage" aria-hidden="true">
    <div className="phone-frame">
      <div className="phone-speaker" />
      <div className="phone-screen">
        <div className="phone-appbar"><Icon name="home" /><strong>AccessHome</strong><span>AH</span></div>
        <p className="phone-kicker">MI RESIDENCIA</p><p className="phone-house">Casa 24<span>Circuito Robles</span></p>
        <div className="phone-pass"><span className="phone-status">Invitación activa</span><strong>Carlos López</strong><span>Hoy · 18:30</span>
          <div className="phone-code"><Icon name="scan" /><span>QR de la visita</span></div>
          <div className="phone-ready"><Icon name="check" />Acceso preparado</div>
        </div>
        <div className="phone-navigation"><Icon name="home" /><Icon name="invitation" /><Icon name="history" /></div>
      </div>
    </div>
    <div className="phone-caption"><Icon name="invitation" /><span>Una invitación.<br /><strong>Un acceso más sencillo.</strong></span></div>
  </FadeContent>
}
