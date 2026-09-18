import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { guardService } from '../services/guardService'
import { GuardScanSession } from '../services/guardScanSession'
import type { ScanPhase } from '../services/guardScanSession'
import { QrCamera } from '../services/qrCamera'
import { usePageTitle } from '../hooks/usePageTitle'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { AccessFeedback } from '../components/access/AccessFeedback'
import type { GuardScanResult } from '../types/guard'

export function GuardScanPage() {
  usePageTitle('Escanear acceso')
  const load = useCallback(() => guardService.getDashboard(), [])
  const { data, error: profileError } = useCommunityQuery(load, 30000)
  const video = useRef<HTMLVideoElement>(null)
  const camera = useRef<QrCamera | null>(null)
  const cameraRequest = useRef(0)
  const session = useRef(new GuardScanSession(guardService.validateToken))
  const mounted = useRef(false)
  const [phase, setPhase] = useState<ScanPhase>('ready')
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active'>('idle')
  const [cameraMessage, setCameraMessage] = useState('')
  const [manual, setManual] = useState('')
  const [result, setResult] = useState<GuardScanResult | null>(null)
  const [error, setError] = useState('')

  const stopCamera = useCallback(() => { cameraRequest.current++; camera.current?.stop(); setCameraState('idle') }, [])
  const run = useCallback(async (operation: () => Promise<GuardScanResult | null>) => {
    stopCamera(); setError('')
    const promise = operation()
    setPhase(session.current.phase)
    try {
      const response = await promise
      if (mounted.current && response) setResult(response)
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : 'No se pudo confirmar la operación.')
    } finally { if (mounted.current) setPhase(session.current.phase) }
  }, [stopCamera])
  const scan = useCallback((input: string, method: 'QR' | 'MANUAL') => {
    if (session.current.phase !== 'ready') return
    void run(() => session.current.scan(input, method))
  }, [run])

  useEffect(() => {
    mounted.current = true
    camera.current = new QrCamera(video.current!, value => scan(value, 'QR'), message => {
      if (mounted.current) { setCameraMessage(message); setCameraState('idle') }
    })
    const hidden = () => { if (document.visibilityState === 'hidden') stopCamera() }
    const leave = () => stopCamera()
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', leave)
    return () => {
      mounted.current = false; cameraRequest.current++; camera.current?.stop(); camera.current = null
      document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leave)
    }
  }, [scan, stopCamera])
  useEffect(() => { if (profileError) stopCamera() }, [profileError, stopCamera])

  async function activate() {
    if (session.current.phase !== 'ready' || cameraState !== 'idle') return
    const request = ++cameraRequest.current
    setCameraMessage(''); setCameraState('starting')
    const started = await camera.current?.start()
    if (mounted.current && request === cameraRequest.current) setCameraState(started ? 'active' : 'idle')
  }
  function next() {
    if (!session.current.next()) return
    setPhase('ready'); setResult(null); setError(''); setManual(''); setCameraMessage('')
    // The next camera request also requires an explicit Activar cámara click.
  }

  return <section className="community-page guard-page guard-scanner">
    <p className="eyebrow">Guardia / Escanear acceso</p><h1>Escanear acceso</h1>
    {data && <p>{data.condominiumName} · Guardia: <strong>{data.guardName}</strong></p>}
    {profileError && <p className="form-error" role="alert">{profileError}</p>}
    <p>Enfoca el QR que presenta el visitante. La primera lectura registra entrada y la siguiente, salida.</p>
    <div className="scanner-camera" aria-label="Cámara para escanear QR" hidden={phase !== 'ready'}>
      <video ref={video} muted playsInline aria-label="Vista de la cámara" hidden={cameraState === 'idle'} />
      {cameraState !== 'active' && <p>{cameraState === 'starting' ? 'Esperando permiso de cámara…' : 'Cámara detenida'}</p>}
    </div>
    {phase === 'ready' && <>
      <div className="scanner-actions">
        <button type="button" className="button-link" disabled={cameraState !== 'idle' || Boolean(profileError)} onClick={() => { void activate() }}>Activar cámara</button>
        <button type="button" className="secondary-button" disabled={cameraState === 'idle'} onClick={stopCamera}>Detener cámara</button>
      </div>
      {cameraMessage && <p className="agenda-notice" role="status">{cameraMessage}</p>}
      <form className="access-validation-form" onSubmit={event => { event.preventDefault(); scan(manual, 'MANUAL') }}>
        <label className="form-field">Enlace o código de invitación<input value={manual} onChange={event => setManual(event.target.value)} required maxLength={2048} autoComplete="off" autoCapitalize="none" spellCheck={false} /></label>
        <p className="form-help">Alternativa sin cámara: pega el enlace completo o el token de la invitación. No se abrirá ninguna página externa.</p>
        <button type="submit" className="secondary-button" disabled={Boolean(profileError)}>Validar código manual</button>
      </form>
    </>}
    {phase === 'pending' && <p className="agenda-notice" role="status">Consultando Supabase y registrando el movimiento… No autorices el paso hasta ver el resultado.</p>}
    {result && <AccessFeedback result={result} operational />}
    {error && <div className={phase === 'uncertain' ? 'agenda-notice' : 'form-error'} role="alert">{error}</div>}
    {phase === 'uncertain' && <button type="button" className="button-link" onClick={() => { void run(() => session.current.retry()) }}>Reintentar misma operación</button>}
    {phase === 'done' && <button type="button" className="button-link scanner-next" onClick={next}>Escanear siguiente</button>}
    <p className="form-help">La lectura se detiene al detectar un código. Verifica nombre, residencia y vehículo antes de permitir el paso. No se registra otro movimiento hasta pulsar Escanear siguiente. Las lecturas de guardia de una misma visita deben separarse al menos 3 segundos.</p>
    <nav className="scanner-actions" aria-label="Consultas de caseta"><Link to="/guardia/historial">Consultar historial</Link><Link to="/guardia">Volver a caseta</Link></nav>
  </section>
}
