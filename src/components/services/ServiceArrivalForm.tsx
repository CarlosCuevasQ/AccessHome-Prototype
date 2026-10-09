import { Disclosure } from '../Disclosure'
import { Skeleton } from '../Skeleton'
import { useCallback, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useCommunityQuery } from '../../hooks/useCommunityQuery'
import { serviceAccessService } from '../../services/serviceAccessService'
import { serviceCategories } from '../../types/services'
import type { ServiceInput, ServiceResult } from '../../types/services'

const empty: ServiceInput = { category: 'paqueteria', residenceId: '', company: '', providerName: '', plates: '', notes: '' }
export function ServiceArrivalForm({ onRegistered }: { onRegistered: (result: ServiceResult) => void }) {
  const load = useCallback(() => serviceAccessService.context(), [])
  const { data, error: contextError, loading } = useCommunityQuery(load, 30000)
  const [input, setInput] = useState(empty)
  const [attempt, setAttempt] = useState<ServiceInput | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const errorId = useId()
  const busy = useRef(false)
  const field = (name: keyof ServiceInput, value: string) => setInput(previous => ({ ...previous, [name]: value }))
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy.current) return
    const captured = attempt ?? { ...input }
    busy.current = true; setAttempt(captured); setPending(true); setError('')
    try {
      const result = await serviceAccessService.register(captured)
      setAttempt(null); setInput(empty); onRegistered(result)
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo registrar la llegada.') }
    finally { busy.current = false; setPending(false) }
  }
  if (loading && !data) return <section className="editor-form service-arrival"><h2>Registrar llegada</h2><Skeleton variant="form" label="Consultando residencias…" /></section>
  return <form className="editor-form service-arrival" onSubmit={event => { void submit(event) }} aria-label="Registrar llegada de servicio" aria-busy={pending}>
    <h2>Registrar llegada</h2><p>Capturar estos datos no permite la entrada. Después verificarás y decidirás en caseta.</p>
    {contextError && <p className="form-error" role="alert">{contextError}</p>}
    <fieldset disabled={pending || attempt !== null || !data} aria-describedby={error ? errorId : undefined}>
      <fieldset><legend className="category-title">1. Categoría</legend><div className="category-choices">
        {Object.entries(serviceCategories).map(([value, label]) => <label key={value}><input type="radio" name="service-category" value={value} checked={input.category === value} onChange={() => field('category', value)} />{label}</label>)}
      </div></fieldset>
      <div className="form-grid">
        <h3 className="form-group-title">2. Destino</h3>
        <label>Residencia destino<select required value={input.residenceId} onChange={e => field('residenceId', e.target.value)}><option value="">Selecciona una residencia</option>{data?.residences.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <h3 className="form-group-title">3. Identificación</h3>
        <label>Empresa (opcional)<input list="service-companies" maxLength={80} value={input.company} onChange={e => field('company', e.target.value)} /><datalist id="service-companies">{['Amazon', 'Estafeta', 'Uber', 'DiDi', 'Uber Eats', 'Otra'].map(company => <option key={company} value={company} />)}</datalist></label>
        <label>Nombre del prestador{['mantenimiento', 'otro'].includes(input.category) ? ' (obligatorio)' : ' (opcional)'}<input required={['mantenimiento', 'otro'].includes(input.category)} maxLength={100} value={input.providerName} onChange={e => field('providerName', e.target.value)} autoComplete="off" /></label>
      </div>
      <Disclosure title="Vehículo y observaciones (opcional)"><div className="form-grid">
        <label>Placas (opcional)<input maxLength={15} value={input.plates} onChange={e => field('plates', e.target.value.toUpperCase())} autoCapitalize="characters" /></label>
        <label>Observaciones breves (opcional)<textarea maxLength={240} rows={2} value={input.notes} onChange={e => field('notes', e.target.value)} /></label>
      </div></Disclosure>
    </fieldset>
    <div className="arrival-next-step"><strong>4. Verificar en caseta</strong><p className="form-help">Después de registrar, revisarás los datos y decidirás si permites la entrada. La empresa no concede acceso. Vigencia: 30 minutos.</p></div>
    <p className="form-help">No captures documentos personales ni datos innecesarios.</p>
    {error && <div id={errorId} role="alert"><p className="form-error">{error}</p><p>Si se perdió la respuesta, reintenta la misma llegada. Antes de capturar otra, comprueba la lista para evitar repetirla.</p></div>}
    <div className="form-actions"><button type="submit" className="button-link" disabled={pending || !data || !data.residences.length}>{pending ? 'Registrando…' : attempt ? 'Reintentar misma llegada' : 'Registrar llegada'}</button>
      {error && <button type="button" className="secondary-button" onClick={() => { setAttempt(null); setError('') }}>Volver al formulario</button>}
    </div>
  </form>
}
