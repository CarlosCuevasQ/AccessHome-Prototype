import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { AccessResult } from '../types/access'
import { accessService } from '../services/accessService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { formatDate } from '../utils/dates'
import { AccessFeedback } from '../components/access/AccessFeedback'
import { AccessHistory } from '../components/access/AccessHistory'

export function AccessControlPage() {
  usePageTitle('Control de acceso')
  const load = useCallback(async () => ({ invitations: await accessService.listActiveInvitations(), records: await accessService.listAccessRecords() }), [])
  const { data, error, loading } = useCommunityQuery(load, 1000)
  const [token, setToken] = useState('')
  const [result, setResult] = useState<AccessResult | null>(null)
  const [validationError, setValidationError] = useState('')
  const [validating, setValidating] = useState(false)
  const pending = useRef(false)

  function changeToken(value: string) {
    setToken(value)
    setResult(null)
    setValidationError('')
  }

  async function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true
    setValidating(true)
    setValidationError('')
    setResult(null)
    try { setResult(await accessService.validateToken(token)) } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'No se pudo validar el acceso.')
    } finally { pending.current = false; setValidating(false) }
  }

  return <section className="community-page access-control-page">
    <p className="eyebrow">Administrador / Seguridad</p>
    <h1>Control de acceso</h1>
    <p className="lead">Simula la lectura de un QR con su token. La primera validación registra entrada y la segunda, salida.</p>
    {loading && <p role="status">Cargando control de acceso…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {data && <>
      <form className="access-validation-form" onSubmit={(event) => { void validate(event) }} aria-label="Validar acceso" aria-busy={validating}>
        <fieldset disabled={validating}>
          <legend className="sr-only">Token de invitación</legend>
          <label className="form-field">Invitación activa (opcional)
            <select value={data.invitations.some((item) => item.token === token) ? token : ''} onChange={(event) => changeToken(event.target.value)}>
              <option value="">Selecciona una invitación</option>
              {data.invitations.map((item) => <option key={item.token} value={item.token}>
                {item.visitorName} · {item.residenceName} · {item.usedUses === 0 ? 'Entrada' : 'Salida'} · {formatDate(item.startsAt)}
              </option>)}
            </select>
          </label>
          <label className="form-field">Token de invitación<input required maxLength={200} autoComplete="off" autoCapitalize="none" spellCheck={false} value={token} onChange={(event) => changeToken(event.target.value)} /></label>
          <p className="form-help">Seleccionar una invitación solo carga su token. Pulsa Validar acceso para registrar el movimiento. Puedes repetir el token para probar el límite de usos.</p>
          <button className="button-link" type="submit">{validating ? 'Validando…' : 'Validar acceso'}</button>
        </fieldset>
      </form>
      {validationError && <p className="form-error" role="alert">{validationError} No se autorizó el acceso.</p>}
      {result && <AccessFeedback result={result} />}
      <AccessHistory records={data.records} />
    </>}
  </section>
}
