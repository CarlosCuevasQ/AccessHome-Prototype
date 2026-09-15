import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { workspaces } from '../data/navigation'
import { usePageTitle } from '../hooks/usePageTitle'
import type { WorkspaceRole } from '../types/navigation'
import { useAuth } from '../hooks/useAuth'
import { demoService } from '../services/demoService'

type ProfileContext = Awaited<ReturnType<typeof demoService.getProfileContext>>

export function WorkspacePage({ role }: { role: WorkspaceRole }) {
  const workspace = workspaces[role]
  usePageTitle(workspace.label)
  const { user } = useAuth()
  const location = useLocation()
  const [profile, setProfile] = useState<ProfileContext | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setProfile(null)
    setError('')
    if (user) {
      demoService.getProfileContext(user.id).then(
        (data) => { if (active) setProfile(data) },
        (error: unknown) => { if (active) setError(error instanceof Error ? error.message : 'No se pudo cargar el perfil.') },
      )
    }
    return () => { active = false }
  }, [user])

  return (
    <section className="workspace-page">
      <p className="eyebrow">{workspace.label} / Mi perfil</p>
      {location.state?.accessDenied && <p className="access-notice" role="alert">Tu perfil no tiene acceso a esa sección. Te llevamos a tu inicio.</p>}
      <h1>{workspace.title}</h1>
      <p>Bienvenido, <strong>{user?.name}</strong>.</p>
      <p className="lead">{workspace.description}</p>
      <div className="stage-banner">
        <span className="status-badge">Etapa 3</span>
        <p>Sesión de demostración activa</p>
      </div>
      <section className="scope-section" aria-labelledby="scope-title">
        <h2 id="scope-title">Tu perfil</h2>
        {error && <p className="form-error" role="alert">{error}</p>}
        <dl className="feature-list">
          <div><dt>Correo</dt><dd>{user?.email}</dd></div>
          <div><dt>Rol</dt><dd>{workspace.label}</dd></div>
          <div><dt>Condominio</dt><dd>{profile?.condominium.name ?? 'Cargando…'}</dd></div>
          {role === 'resident' && <div><dt>Residencia</dt><dd>{profile?.residence?.name ?? 'Cargando…'}</dd></div>}
        </dl>
      </section>
      <p className="muted">Tu sesión se conserva al recargar. Para probar el otro perfil, cierra sesión desde el menú e ingresa con su cuenta.</p>
    </section>
  )
}
