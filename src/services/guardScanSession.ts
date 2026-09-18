import type { GuardScanResult } from '../types/guard.js'

export function accessTokenFromCode(input: string): string {
  const value = input.trim()
  if (/^[a-f0-9]{64}$/.test(value)) return value
  if (value.length <= 2048) {
    try {
      const url = new URL(value)
      const match = /^\/invitacion\/([a-f0-9]{64})\/?$/.exec(url.pathname)
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash && match) return match[1]
    } catch { /* The scanned text is never navigated to, fetched or logged. */ }
  }
  throw new Error('Código no válido. Escanea el QR de AccessHome o introduce su enlace completo o token.')
}

export type ScanPhase = 'ready' | 'pending' | 'done' | 'uncertain'
type Method = 'QR' | 'MANUAL'
export class GuardScanSession {
  phase: ScanPhase = 'ready'
  private attempt: { token: string; method: Method } | null = null
  constructor(private validate: (token: string, method: Method) => Promise<GuardScanResult>) {}

  async scan(input: string, method: Method): Promise<GuardScanResult | null> {
    if (this.phase !== 'ready') return null
    // Claim synchronously, before any async work or React state update.
    this.phase = 'done'
    this.attempt = { token: accessTokenFromCode(input), method }
    return this.run()
  }
  async retry(): Promise<GuardScanResult | null> {
    if (this.phase !== 'uncertain') return null
    return this.run()
  }
  private async run(): Promise<GuardScanResult> {
    this.phase = 'pending'
    try {
      const result = await this.validate(this.attempt!.token, this.attempt!.method)
      this.phase = 'done'
      return result
    } catch {
      this.phase = 'uncertain'
      throw new Error('No se pudo confirmar la operación. No autorices el paso por este aviso. Reintenta la misma operación o consulta el historial; podría haberse registrado.')
    }
  }
  next(): boolean {
    if (this.phase !== 'done') return false
    this.phase = 'ready'; this.attempt = null
    return true
  }
}
