import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { guardService } from '../services/guardService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { AccessFeedback } from '../components/access/AccessFeedback'
import { formatDate } from '../utils/dates'
import type { GuardAccess, GuardScanResult } from '../types/guard'

export function GuardExitPage() {
  usePageTitle('Registrar salida sin QR')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const load = useCallback(() => guardService.getOpenVisits(page), [page, revision])
  const { data, error, loading } = useCommunityQuery(load, 30000)
  const [selection, setSelection] = useState<{ entry: GuardAccess; zone: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [operationError, setOperationError] = useState('')
  const [result, setResult] = useState<GuardScanResult | null>(null)
  const busy = useRef(false)
  const confirmation = useRef<HTMLElement>(null)
  const feedback = useRef<HTMLDivElement>(null)
  const selectedButton = useRef<HTMLButtonElement | null>(null)
  useEffect(() => { if (selection) confirmation.current?.focus() }, [selection])
  useEffect(() => { if (result) feedback.current?.focus() }, [result])

  async function confirmExit() {
    if (!selection || busy.current) return
    busy.current = true; setPending(true); setOperationError('')
    try {
      const response = await guardService.registerExit(selection.entry.id)
      setResult(response); setSelection(null); setRevision(value => value + 1)
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'No se pudo confirmar la salida.')
    } finally { busy.current = false; setPending(false) }
  }

  return <section className="community-page guard-page">
    <Link to="/guardia">Volver a caseta</Link>
    <h1>Registrar salida sin QR</h1>
    <p>Verifica la identidad del visitante y selecciona su entrada. Solo se muestran visitas pendientes de salida de tu condominio.</p>
    <Link to="/guardia/escanear">Escanear acceso con QR</Link>
    {selection && <section ref={confirmation} tabIndex={-1} className="delete-confirmation" aria-label="Confirmar salida" aria-busy={pending}>
      <h2>Confirmar salida de {selection.entry.visitorName}</h2>
      <p><strong>{selection.entry.residenceName}</strong></p>
      <p>Entrada: {formatDate(selection.entry.occurredAt, selection.zone)} · {selection.zone}</p>
      <p>{selection.entry.vehicle ? `Placas: ${selection.entry.vehicle.plates}` : 'Sin vehículo'}</p>
      <p>Se registrará la salida con tu cuenta, la hora del servidor y el método manual.</p>
      {operationError && <><p className="form-error" role="alert">{operationError}</p><p>No se pudo confirmar el resultado. Reintenta para recuperar la misma operación; no autorices otro paso sin comprobarlo.</p></>}
      <div className="form-actions">
        <button className="secondary-button" disabled={pending} onClick={() => { setSelection(null); setOperationError(''); selectedButton.current?.focus() }}>Volver a la lista</button>
        <button className="button-link" disabled={pending} onClick={() => { void confirmExit() }}>{pending ? 'Registrando…' : operationError ? 'Reintentar la misma salida' : 'Confirmar salida'}</button>
      </div>
    </section>}
    {result && <div ref={feedback} tabIndex={-1}><AccessFeedback result={result} operational /><button className="secondary-button" onClick={() => { setResult(null); setRevision(value => value + 1) }}>Consultar pendientes</button></div>}
    {!selection && !result && <>
      <div className="guard-updates"><p className="form-help">Actualización cada 30 segundos. La salida se vuelve a comprobar al confirmar.</p><button className="secondary-button" disabled={loading} onClick={() => setRevision(value => value + 1)}>Actualizar visitas</button></div>
      {loading && <p role="status">Consultando entradas abiertas…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {data && <>
        <p className="form-help">Horarios del condominio · {data.timeZone}</p>
        {data.records.length === 0 && <p>No hay visitas pendientes en esta página.</p>}
        <ul className="guard-open-visits">{data.records.map(entry => <li key={entry.id}>
          <div><strong>{entry.visitorName}</strong><p>{entry.residenceName} · {entry.vehicle ? `Placas: ${entry.vehicle.plates}` : 'Sin vehículo'}</p><p>Entrada: {formatDate(entry.occurredAt, data.timeZone)}</p></div>
          <button className="secondary-button" aria-label={`Registrar salida de ${entry.visitorName}, ${entry.residenceName}`} onClick={event => { selectedButton.current = event.currentTarget; setSelection({ entry, zone: data.timeZone }); setOperationError('') }}>Registrar salida</button>
        </li>)}</ul>
        <nav className="guard-pagination" aria-label="Páginas de visitas pendientes">
          <button className="secondary-button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page + 1}</span>
          <button className="secondary-button" disabled={!data.hasMore} onClick={() => setPage(value => value + 1)}>Siguiente</button>
        </nav>
      </>}
    </>}
  </section>
}
