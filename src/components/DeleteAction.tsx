import { useEffect, useRef, useState } from 'react'

interface DeleteActionProps {
  label: string
  description: string
  onDelete: () => Promise<void>
  onDeleted: () => void
}

export function DeleteAction({ label, description, onDelete, onDeleted }: DeleteActionProps) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const cancelButton = useRef<HTMLButtonElement>(null)
  const triggerButton = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (confirming) cancelButton.current?.focus() }, [confirming])

  async function remove() {
    setDeleting(true)
    setError('')
    try {
      await onDelete()
      setConfirming(false)
      onDeleted()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo eliminar el registro.')
    } finally {
      setDeleting(false)
    }
  }

  return <div className="delete-action">
    <button ref={triggerButton} type="button" className="secondary-button delete-button" aria-expanded={confirming} disabled={deleting} onClick={() => { setConfirming(true); setError('') }}>{label}</button>
    {confirming && <div className="delete-confirmation" role="group" aria-label={`Confirmar: ${label}`}>
      <p>{description} Esta acción no se puede deshacer.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button ref={cancelButton} type="button" className="secondary-button" disabled={deleting} onClick={() => { setConfirming(false); triggerButton.current?.focus() }}>Cancelar</button>
        <button type="button" className="secondary-button delete-button" disabled={deleting} onClick={() => { void remove() }}>{deleting ? 'Eliminando…' : 'Confirmar eliminación'}</button>
      </div>
    </div>}
  </div>
}
