import { useEffect, useRef, useState } from 'react'
import { invitationsService } from '../../services/invitationsService'

export function CancelInvitation({ id, visitorName }: { id: string; visitorName: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const keepButton = useRef<HTMLButtonElement>(null)
  const openButton = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (confirming) keepButton.current?.focus() }, [confirming])

  async function cancel() {
    setPending(true)
    setError('')
    try { await invitationsService.cancelInvitation(id) } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo cancelar la invitación.')
    } finally { setPending(false) }
  }

  return <div className="cancel-invitation">
    <button ref={openButton} className="secondary-button" onClick={() => setConfirming(true)} aria-expanded={confirming}>Cancelar invitación</button>
    {confirming && <section className="delete-confirmation" aria-label="Confirmar cancelación" aria-busy={pending}>
      <h2>Cancelar la visita de {visitorName}</h2><p>La invitación dejará de estar activa. Conservarás sus datos en el historial y podrás generar otra.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button ref={keepButton} className="secondary-button" disabled={pending} onClick={() => { setConfirming(false); openButton.current?.focus() }}>Mantener invitación</button><button className="button-link" disabled={pending} onClick={() => { void cancel() }}>{pending ? 'Cancelando…' : 'Confirmar cancelación'}</button></div>
    </section>}
  </div>
}
