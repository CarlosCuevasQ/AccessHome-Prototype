import { sharedMode } from '../services/shared/provider'
import { Outlet, useLocation } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { RouteFocus } from '../components/RouteFocus'

export function PublicLayout({ visitor = false }: { visitor?: boolean }) {
  const login = useLocation().pathname === '/login'
  return (
    <div className={`public-layout${visitor ? ' visitor-layout' : ''}${login ? ' login-layout' : ''}`}>
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <RouteFocus />
      {!login && <header className="public-header">
        <Brand />
        <span className="header-caption">{sharedMode ? 'Modo compartido' : 'Modo local'}</span>
      </header>}
      <main id="main-content" tabIndex={-1} className="public-main"><Outlet /></main>
      {!login && <footer className="public-footer">
        <span>AccessHome · Prototipo universitario</span>
        {!visitor && <span>Tu comunidad, conectada.</span>}
      </footer>}
    </div>
  )
}

