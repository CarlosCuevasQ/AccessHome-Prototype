import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { Navigation } from '../components/Navigation'
import { RouteFocus } from '../components/RouteFocus'
import { workspaces } from '../data/navigation'
import type { WorkspaceRole } from '../types/navigation'

export function WorkspaceLayout({ role }: { role: WorkspaceRole }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const workspace = workspaces[role]

  return (
    <div className="workspace-layout">
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <RouteFocus />
      <header className="workspace-header">
        <Brand />
        <span className="workspace-role">{workspace.label}</span>
        <button className="menu-toggle" aria-expanded={menuOpen} aria-controls="workspace-sidebar" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? 'Cerrar menú' : 'Abrir menú'}
        </button>
      </header>
      <aside id="workspace-sidebar" className={`sidebar${menuOpen ? ' is-open' : ''}`}>
        <p className="sidebar-label">{workspace.label}</p>
        <Navigation items={workspace.navigation} onNavigate={() => {
          setMenuOpen(false)
          document.getElementById('main-content')?.focus({ preventScroll: true })
        }} />
        <div className="sidebar-bottom">
          <Link to="/login">Cambiar de perfil</Link>
          <p>Entorno de demostración</p>
        </div>
      </aside>
      <main id="main-content" tabIndex={-1} className="workspace-main"><Outlet /></main>
    </div>
  )
}
