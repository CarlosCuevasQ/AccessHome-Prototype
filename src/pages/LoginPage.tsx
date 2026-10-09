import { Brand } from '../components/Brand'
import { LoginPhone } from '../components/LoginPhone'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAuth } from '../hooks/useAuth'
import { authService } from '../services/authService'
import { getRoleHome } from '../utils/auth'
import { DemoTools } from '../components/DemoTools'
import { sharedMode } from '../services/shared/provider'

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
        <Brand />
        <div className="login-message"><p className="eyebrow">Tu comunidad, conectada</p>
          <h1 id="login-title">Un punto de acceso.<br />Una comunidad conectada.</h1>
          <p className="lead">Invita, comparte y recibe. Todo empieza en casa.</p>
        </div>
        <LoginPhone />
      </div>
      <div className="login-access">
        <div className="login-form-content"><p className="eyebrow">Acceso a tu comunidad</p>
        <h2>Bienvenido</h2>
        <p>{sharedMode ? 'Ingresa para continuar en tu comunidad.' : 'Explora la demostración local con tu correo.'}</p>
        <form className="login-form" onSubmit={(event) => { void submit(event) }} aria-busy={submitting || loading}>
          <div className="form-field">
            <label htmlFor="email">Correo electrónico</label>
            <input aria-describedby={(error || sessionError) ? "login-error" : undefined} id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} />
          </div>
          {sharedMode && <div className="form-field">
            <label htmlFor="password">Contraseña</label>
            <input aria-describedby={(error || sessionError) ? "login-error" : undefined} id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} />
          </div>}
          {(error || sessionError) && <p id="login-error" className="form-error" role="alert">{error || sessionError}</p>}
          <button className="button-link" type="submit" disabled={submitting || loading}>{loading ? 'Recuperando sesión…' : submitting ? 'Entrando…' : 'Iniciar sesión'}</button>
        </form>
        <p className="access-note">{sharedMode ? 'Usa la cuenta que te asignó la administración.' : 'Modo local · Sin autenticación real. Los datos solo existen en este navegador.'}</p>
        {!sharedMode && <DemoTools />}
        </div>
        <p className="login-signoff">AccessHome · Gestión residencial</p>
      </div>
    </section>
  )
}
