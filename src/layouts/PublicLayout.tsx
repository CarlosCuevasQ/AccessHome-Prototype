import { Outlet } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { RouteFocus } from '../components/RouteFocus'

export function PublicLayout() {
  return (
    <div className="public-layout">
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <RouteFocus />
      <header className="public-header">
        <Brand />
        <span className="header-caption">Seguridad residencial</span>
      </header>
      <main id="main-content" tabIndex={-1} className="public-main"><Outlet /></main>
      <footer className="public-footer">
        <span>AccessHome · Prototipo universitario</span>
        <span>Etapa 1 / Navegación inicial</span>
      </footer>
    </div>
  )
}
