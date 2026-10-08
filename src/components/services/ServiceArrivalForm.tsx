import { useCallback, useRef, useState } from 'react'
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
  return <form className="editor-form service-arrival" onSubmit={event => { void submit(event) }} aria-label="Registrar llegada de servicio">
    <h2>Registrar llegada</h2><p>Capturar estos datos no permite la entrada. Después verificarás y decidirás en caseta.</p>
    {loading && <p role="status">Consultando residencias…</p>}{contextError && <p className="form-error" role="alert">{contextError}</p>}
    <fieldset disabled={pending || attempt !== null || !data}>
      <div className="form-grid">
        <label>Categoría<select value={input.category} onChange={e => field('category', e.target.value)}>{Object.entries(serviceCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Empresa (opcional)<input list="service-companies" maxLength={80} value={input.company} onChange={e => field('company', e.target.value)} /><datalist id="service-companies">{['Amazon', 'Estafeta', 'Uber', 'DiDi', 'Uber Eats', 'Otra'].map(company => <option key={company} value={company} />)}</datalist></label>
        <label>Residencia destino<select required value={input.residenceId} onChange={e => field('residenceId', e.target.value)}><option value="">Selecciona una residencia</option>{data?.residences.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label>Nombre del prestador{['mantenimiento', 'otro'].includes(input.category) ? ' (obligatorio)' : ' (opcional)'}<input required={['mantenimiento', 'otro'].includes(input.category)} maxLength={100} value={input.providerName} onChange={e => field('providerName', e.target.value)} autoComplete="off" /></label>
        <label>Placas (opcional)<input maxLength={15} value={input.plates} onChange={e => field('plates', e.target.value.toUpperCase())} autoCapitalize="characters" /></label>
        <label>Observaciones breves (opcional)<textarea maxLength={240} rows={2} value={input.notes} onChange={e => field('notes', e.target.value)} /></label>
      </div>
    </fieldset>
    <p className="form-help">No captures documentos personales ni datos innecesarios. La empresa no concede acceso. Vigencia para decidir entrada: 30 minutos.</p>
    {error && <div role="alert"><p className="form-error">{error}</p><p>Si se perdió la respuesta, reintenta la misma llegada. Antes de capturar otra, comprueba la lista para evitar repetirla.</p></div>}
    <div className="form-actions"><button className="button-link" disabled={pending || !data || !data.residences.length}>{pending ? 'Registrando…' : attempt ? 'Reintentar misma llegada' : 'Registrar llegada'}</button>
      {error && <button type="button" className="secondary-button" onClick={() => { setAttempt(null); setError('') }}>Volver al formulario</button>}
    </div>
  </form>
}
