import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { guardReportsService } from '../services/guardReportsService'
import type { ShiftContext, ShiftInput, ShiftPreview, ShiftResult } from '../types/guardReports'
import { GuardReportSummary } from './GuardReportSummary'

export function GuardReportForm({ context, done, close }: { context: ShiftContext; done: (result: ShiftResult) => void; close: () => void }) {
  const [input, setInput] = useState<ShiftInput>({ start: context.start, end: context.end, notes: '', incidents: '' })
  const [preview, setPreview] = useState<ShiftPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempted, setAttempted] = useState(false)
  const pending = useRef(false)
  const summary = useRef<HTMLElement>(null)
  async function run(generate: boolean) {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      if (generate) { setAttempted(true); done(await guardReportsService.generate(input)) }
      else { setPreview(await guardReportsService.preview(input)); requestAnimationFrame(() => summary.current?.focus()) }
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo consultar el servidor.') }
    finally { pending.current = false; setBusy(false) }
  }
  function submit(e: FormEvent) { e.preventDefault(); void run(false) }
  return <section className="editor-form shift-form" aria-busy={busy}>
    <h2>Generar reporte de turno</h2>
    {!preview ? <form onSubmit={submit}>
      <p>Introduce las horas del condominio: <strong>{context.timeZone}</strong>. Periodo terminado de hasta 7 días.</p>
      <fieldset disabled={busy}><div className="form-grid">
        <label>Inicio del turno<input type="datetime-local" step="60" required value={input.start} onChange={e => setInput({ ...input, start: e.target.value })} /></label>
        <label>Fin del turno<input type="datetime-local" step="60" required value={input.end} onChange={e => setInput({ ...input, end: e.target.value })} /></label>
        <label>Observaciones generales<textarea rows={3} maxLength={2000} value={input.notes} onChange={e => setInput({ ...input, notes: e.target.value })} /></label>
        <label>Incidencias del turno<textarea rows={3} maxLength={2000} value={input.incidents} onChange={e => setInput({ ...input, incidents: e.target.value })} /></label>
      </div></fieldset><p className="form-help">Texto simple, hasta 2000 caracteres por campo. No incluyas documentos ni datos sensibles innecesarios.</p>
      <button className="button-link" disabled={busy}>{busy ? 'Consultando…' : 'Calcular vista previa'}</button>
    </form> : <section ref={summary} tabIndex={-1}>
      <h3>Vista previa · todavía no es un cierre</h3><GuardReportSummary report={preview} />
      <h3>Observaciones</h3><p className="shift-text">{input.notes || 'Sin observaciones.'}</p>
      <h3>Incidencias</h3><p className="shift-text">{input.incidents || 'Sin incidencias declaradas.'}</p>
      <p>Al confirmar, el servidor vuelve a calcular. Se guardará un reporte finalizado que no admite edición ni eliminación.</p>
      <div className="form-actions"><button className="button-link" disabled={busy} onClick={() => { void run(true) }}>{busy ? 'Generando…' : attempted ? 'Reintentar mismo cierre' : 'Generar reporte'}</button>
        {!attempted && <button className="secondary-button" disabled={busy} onClick={() => setPreview(null)}>Corregir periodo o texto</button>}</div>
    </section>}
    {error && <div role="alert"><p className="form-error">{error}</p>{attempted && <p>Si se perdió la respuesta, reintenta el mismo cierre. Antes de iniciar otro, consulta los reportes existentes.</p>}</div>}
    <button className="secondary-button" disabled={busy} onClick={close}>Volver a los reportes</button>
  </section>
}
