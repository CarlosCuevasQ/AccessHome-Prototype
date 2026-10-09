import { useEffect, useRef, useState } from 'react'
import { serviceAccessService } from '../../services/serviceAccessService'
import type { ServiceOperation, ServiceResult, ServiceVisit } from '../../types/services'
import { ServiceDetails } from './ServiceDetails'

type Decision = Exclude<ServiceOperation, 'register'>
const labels: Record<Decision, string> = { allow: 'Permitir entrada', reject: 'Rechazar acceso', cancel: 'Cancelar registro', exit: 'Registrar salida' }
export function ServiceDecision({ visit, operation, zone, close, done }: { visit: ServiceVisit; operation: Decision; zone: string; close: () => void; done: (result: ServiceResult) => void }) {
  const [confirmed, setConfirmed] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const container = useRef<HTMLElement>(null)
  useEffect(() => { container.current?.focus() }, [])
  async function submit() {
    if (busy.current || (operation === 'allow' && !confirmed)) return
    busy.current = true; setPending(true); setError('')
    try { done(await serviceAccessService.decide(operation, visit.id, reason)) }
    catch (error) { setError(error instanceof Error ? error.message : 'No se pudo confirmar la operación.') }
    finally { busy.current = false; setPending(false) }
  }
  return <section ref={container} tabIndex={-1} className="delete-confirmation service-confirmation" aria-label={labels[operation]} aria-busy={pending}>
    <h2>{labels[operation]}</h2><ServiceDetails visit={visit} zone={zone} />
    {operation === 'allow' && <label className="service-consent"><input type="checkbox" checked={confirmed} disabled={pending} onChange={e => setConfirmed(e.target.checked)} />Confirmo que verifiqué este servicio y autorizo su entrada. Se registrará una entrada real.</label>}
    {operation === 'exit' && <p>Confirmo que este servicio se retira. Se registrará una salida real con mi cuenta y la hora del servidor.</p>}
    {operation === 'reject' && <label>Motivo de rechazo (opcional)<textarea maxLength={240} value={reason} disabled={pending || Boolean(error)} onChange={e => setReason(e.target.value)} /></label>}
    {operation === 'cancel' && <p>Se conservará la llegada, sin registrar entrada. Una nueva llegada requiere otro registro.</p>}
    {error && <div role="alert"><p className="form-error">{error}</p><p>Reintentar conserva la misma operación. Si ya cambió el estado, vuelve a la lista para consultarlo.</p></div>}
    <div className="form-actions"><button className="secondary-button" disabled={pending} onClick={close}>Volver a la lista</button><button className={`button-link${operation === 'reject' || operation === 'cancel' ? ' danger-button' : ''}`} aria-busy={pending} disabled={pending || (operation === 'allow' && !confirmed)} onClick={() => { void submit() }}>{pending ? 'Registrando…' : error ? 'Reintentar misma operación' : labels[operation]}</button></div>
  </section>
}
