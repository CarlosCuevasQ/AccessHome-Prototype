import { useState } from 'react'
import { demoService } from '../services/demoService'
import { sharedMode } from '../services/shared/provider'

export function DemoTools() {
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const credentials = demoService.getCredentials()

  if (sharedMode) return <p className="form-help">Solicita al responsable tu cuenta y contraseña individual. Daniel corresponde al principal de Casa 24. Los datos se comparten entre dispositivos.</p>

  async function reset() {
    setResetting(true)
    setError('')
    setMessage('')
    try {
      await demoService.resetDemoData()
      setConfirmReset(false)
      setMessage('Datos demo restaurados. Puedes iniciar sesión con las credenciales originales.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudieron restaurar los datos.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="demo-tools">
      <details>
        <summary>Cuentas locales de demostración</summary>
        <dl className="demo-credentials">
          {credentials.map((account) => (
            <div key={account.email}>
              <dt>{account.role === 'admin' ? 'Administrador' : 'Residente'}</dt>
              <dd>{account.email}</dd>
              <dd>Acceso local sin contraseña</dd>
            </div>
          ))}
        </dl>
      </details>
      <button type="button" className="text-button" onClick={() => { setConfirmReset(true); setMessage(''); setError('') }}>Restaurar datos demo</button>
      {confirmReset && (
        <div className="reset-confirmation" role="group" aria-label="Confirmar restauración de datos demo">
          <p>Se reemplazarán todos los datos de AccessHome por los originales y se cerrará la sesión en las pestañas de este navegador. Los datos de otras aplicaciones se conservarán.</p>
          <div className="form-actions">
            <button type="button" className="secondary-button" disabled={resetting} onClick={() => { void reset() }}>{resetting ? 'Restaurando…' : 'Confirmar restauración'}</button>
            <button type="button" className="text-button" disabled={resetting} onClick={() => setConfirmReset(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {message && <p className="form-success" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}
