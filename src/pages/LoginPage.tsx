import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAuth } from '../hooks/useAuth'
import { authService } from '../services/authService'
import { getRoleHome } from '../utils/auth'
import { DemoTools } from '../components/DemoTools'

export function LoginPage() {
  usePageTitle('Iniciar sesión')
  const { user, loading, error: sessionError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await authService.login({ email, password })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo iniciar sesión.')
    } finally {
      setSubmitting(false)
    }
  }

  if (user) return <Navigate to={getRoleHome(user.role)} replace />

  return (
    <section className="login-page" aria-labelledby="login-title">
      <div className="login-introduction">
        <p className="eyebrow">Gestión de acceso residencial</p>
        <h1 id="login-title">Un punto de acceso.<br />Una comunidad conectada.</h1>
        <p className="lead">Bienvenido a AccessHome, un espacio para organizar el acceso y la vida de tu comunidad.</p>
        <div className="project-note">
          <span className="status-badge">Prototipo en desarrollo</span>
          <p>Explora AccessHome con una cuenta de demostración de administrador o residente.</p>
        </div>
      </div>
      <div className="login-access">
        <p className="eyebrow">Acceso a tu comunidad</p>
        <h2>Iniciar sesión</h2>
        <p>Ingresa con tu correo y contraseña de demostración.</p>
        <form className="login-form" onSubmit={(event) => { void submit(event) }} aria-busy={submitting || loading}>
          <div className="form-field">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} />
          </div>
          <div className="form-field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} />
          </div>
          {(error || sessionError) && <p className="form-error" role="alert">{error || sessionError}</p>}
          <button className="button-link" type="submit" disabled={submitting || loading}>{loading ? 'Recuperando sesión…' : submitting ? 'Entrando…' : 'Iniciar sesión'}</button>
        </form>
        <p className="access-note">Autenticación simulada para la presentación. Utiliza únicamente los datos de demostración.</p>
        <DemoTools />
      </div>
    </section>
  )
}
