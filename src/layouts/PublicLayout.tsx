import { sharedMode } from '../services/shared/provider'
import { Outlet } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { RouteFocus } from '../components/RouteFocus'

export function PublicLayout({ visitor = false }: { visitor?: boolean }) {
  return (
    <div className={`public-layout${visitor ? ' visitor-layout' : ''}`}>
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <RouteFocus />
      <header className="public-header">
        <Brand />
        <span className="header-caption">{sharedMode ? 'Modo compartido' : 'Modo local'}</span>
      </header>
      <main id="main-content" tabIndex={-1} className="public-main"><Outlet /></main>
      <footer className="public-footer">
        <span>AccessHome · Prototipo universitario</span>
        {!visitor && <span>Etapa 7 / Historial y reportes</span>}
      </footer>
    </div>
  )
}

