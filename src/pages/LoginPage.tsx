import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'

export function LoginPage() {
  usePageTitle('Acceso temporal')

  return (
    <section className="login-page" aria-labelledby="login-title">
      <div className="login-introduction">
        <p className="eyebrow">Gestión de acceso residencial</p>
        <h1 id="login-title">Un punto de acceso.<br />Una comunidad conectada.</h1>
        <p className="lead">Bienvenido a AccessHome, un espacio para organizar el acceso y la vida de tu comunidad.</p>
        <div className="project-note">
          <span className="status-badge">Prototipo en desarrollo</span>
          <p>En esta primera etapa puedes explorar la navegación y los espacios de cada perfil.</p>
        </div>
      </div>
      <div className="login-access">
        <p className="eyebrow">Acceso temporal</p>
        <h2>Elige un perfil</h2>
        <p>Entra a la demostración sin correo ni contraseña.</p>
        <div className="profile-options">
          <Link className="profile-option" to="/admin">
            <span><strong>Administrador</strong><span>Explora el espacio de administración.</span></span>
            <span className="profile-arrow" aria-hidden="true">→</span>
          </Link>
          <Link className="profile-option" to="/residente">
            <span><strong>Residente</strong><span>Explora el espacio del residente.</span></span>
            <span className="profile-arrow" aria-hidden="true">→</span>
          </Link>
        </div>
        <p className="access-note">Acceso de demostración. La autenticación y los permisos todavía no están implementados.</p>
      </div>
    </section>
  )
}
