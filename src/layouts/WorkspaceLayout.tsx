import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { Navigation } from '../components/Navigation'
import { RouteFocus } from '../components/RouteFocus'
import { workspaces } from '../data/navigation'
import type { WorkspaceRole } from '../types/navigation'
import { useAuth } from '../hooks/useAuth'
import { authService } from '../services/authService'

export function WorkspaceLayout({ role }: { role: WorkspaceRole }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const workspace = workspaces[role]
  const { user } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')

  async function logout() {
    setLoggingOut(true)
    setError('')
    try {
      await authService.logout()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo cerrar la sesión.')
    } finally {
      setLoggingOut(false)
    }
  }

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
          <p className="session-name">{user?.name}</p>
          <button type="button" className="text-button" disabled={loggingOut} onClick={() => { void logout() }}>{loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>
          {error && <div className="form-error" role="alert">{error}</div>}
          <p>Entorno de demostración</p>
        </div>
      </aside>
      <main id="main-content" tabIndex={-1} className="workspace-main"><Outlet /></main>
    </div>
  )
}
