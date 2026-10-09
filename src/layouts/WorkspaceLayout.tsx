import { sharedMode } from '../services/shared/provider'
import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Brand } from '../components/Brand'
import { Navigation } from '../components/Navigation'
import { RouteFocus } from '../components/RouteFocus'
import { workspaces } from '../data/navigation'
import type { WorkspaceRole } from '../types/navigation'
import { useAuth } from '../hooks/useAuth'
import { authService } from '../services/authService'

export function WorkspaceLayout({ role, showContacts = false }: { role: WorkspaceRole; showContacts?: boolean }) {
  const drawer = useRef<HTMLDialogElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const navigated = useRef(false)
  const workspace = workspaces[role]
  const location = useLocation()
  const items = workspace.navigation.filter(item => item.path !== '/residente/contactos' || showContacts)
  const current = [...items].reverse().find(item => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))
  const closeMenu = () => { navigated.current = false; drawer.current?.close() }
  const navigateMenu = () => { navigated.current = true; drawer.current?.close() }
  useEffect(() => { if (drawer.current?.open) { navigated.current = true; drawer.current.close() } }, [location.pathname])
  useEffect(() => {
    const media = window.matchMedia('(min-width: 901px)')
    const resize = () => { if (media.matches) drawer.current?.close() }
    media.addEventListener('change', resize)
    return () => media.removeEventListener('change', resize)
  }, [])
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
    <div className={`workspace-layout${role === 'guard' ? ' guard-workspace' : ''}`}>
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <RouteFocus />
      <header className="workspace-header">
        <div className="mobile-brand"><Brand /></div>
        <div className="workspace-context"><span>{workspace.label}</span><strong>{current?.label ?? workspace.title}</strong></div>
        <div className="workspace-account"><span className="avatar" aria-hidden="true">{user?.name?.slice(0, 1)}</span><span>{user?.name}<small>{workspace.label}</small></span></div>
        <button ref={menuButton} className="menu-toggle" aria-haspopup="dialog" onClick={() => drawer.current?.showModal()}><Icon name="menu" />Menú</button>
      </header>
      <aside className="sidebar">
        <Brand />
        <p className="sidebar-label">{workspace.label}</p>
        <Navigation items={items} onNavigate={() => { document.getElementById('main-content')?.focus({ preventScroll: true }) }} />
        <div className="sidebar-bottom">
          <p className="session-name">{user?.name}</p>
          <button type="button" className="text-button" disabled={loggingOut} onClick={() => { void logout() }}><Icon name="exit" />{loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>
          {error && <div className="form-error" role="alert">{error}</div>}
          <p>{sharedMode ? 'Modo compartido' : 'Modo local · Este navegador'}</p>
        </div>
      </aside>
      <dialog ref={drawer} className="mobile-drawer" aria-labelledby="drawer-title" onCancel={() => { navigated.current = false }} onClose={() => {
        if (navigated.current) document.getElementById('main-content')?.focus({ preventScroll: true })
        else if (menuButton.current?.getClientRects().length) menuButton.current.focus()
      }}>
        <div className="drawer-heading"><h2 id="drawer-title">AccessHome <small>{workspace.label}</small></h2><button className="secondary-button" onClick={closeMenu} aria-label="Cerrar menú"><Icon name="close" /></button></div>
        <p>{user?.name}</p>
        <Navigation items={items} onNavigate={navigateMenu} />
        <button type="button" className="text-button" disabled={loggingOut} onClick={() => { void logout() }}><Icon name="exit" />{loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>
        {error && <p className="form-error" role="alert">{error}</p>}
        {!sharedMode && <p className="form-help">Modo local · Este navegador</p>}
      </dialog>
      <main id="main-content" tabIndex={-1} className="workspace-main"><Outlet /></main>
    </div>
  )
}

