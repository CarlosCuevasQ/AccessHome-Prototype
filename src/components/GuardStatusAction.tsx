import { useEffect, useRef, useState } from 'react'
import { guardManagementService } from '../services/guardManagementService'
import type { ManagedGuard } from '../types/guard'

interface GuardStatusActionProps {
  guard: ManagedGuard
  onChanged: (message: string) => void
}

// Desactivar pide confirmación; activar es directo. El servidor decide: si el responsable
// del sistema bloqueó al guardia, la activación se rechaza y se muestra su mensaje.
export function GuardStatusAction({ guard, onChanged }: GuardStatusActionProps) {
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const cancelButton = useRef<HTMLButtonElement>(null)
  const triggerButton = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (confirming) cancelButton.current?.focus() }, [confirming])
  const enabling = !guard.active

  async function apply() {
    setSaving(true)
    setError('')
    try {
      const result = await guardManagementService.setStatus(guard.id, enabling)
      setConfirming(false)
      onChanged(!result.changed
        ? `${result.name} ya estaba ${result.active ? 'activo' : 'inactivo'}; no se registró ningún cambio.`
        : result.active ? `Acceso de ${result.name} activado.` : `Acceso de ${result.name} desactivado. Lo pierde en su siguiente operación en caseta.`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo cambiar el acceso del guardia.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="guard-status-action">
    {enabling
      ? <button type="button" className="secondary-button" disabled={saving} aria-busy={saving} onClick={() => { void apply() }}>{saving ? 'Activando…' : 'Activar acceso'}</button>
      : <button ref={triggerButton} type="button" className="secondary-button delete-button" aria-expanded={confirming} disabled={saving} onClick={() => { setConfirming(true); setError('') }}>Desactivar acceso</button>}
    {confirming && <div className="delete-confirmation" role="group" aria-label={`Confirmar: desactivar a ${guard.name}`}>
      <p>{guard.name} dejará de usar la caseta en su siguiente operación, aunque tenga la sesión abierta. Su historial y sus registros se conservan, y podrás reactivarlo después.</p>
      <div className="form-actions">
        <button ref={cancelButton} type="button" className="secondary-button" disabled={saving} onClick={() => { setConfirming(false); triggerButton.current?.focus() }}>Cancelar</button>
        <button type="button" className="secondary-button delete-button" disabled={saving} aria-busy={saving} onClick={() => { void apply() }}>{saving ? 'Desactivando…' : 'Confirmar desactivación'}</button>
      </div>
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>
}
