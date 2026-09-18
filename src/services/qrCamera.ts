import type { DecodeQR } from 'qr/decode.js'

interface CameraRuntime {
  open: () => Promise<MediaStream>
  decoder: () => Promise<DecodeQR>
  canvas: () => HTMLCanvasElement
  schedule: (fn: () => void) => number
  cancel: (id: number) => void
}
const browserRuntime: CameraRuntime = {
  async open() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('unavailable')
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
  },
  decoder: async () => (await import('qr/decode.js')).decodeQR,
  canvas: () => document.createElement('canvas'),
  schedule: fn => window.setTimeout(fn, 200),
  cancel: id => window.clearTimeout(id),
}

// No permission requests in the constructor. Only start(), called by user action,
// opens a stream. A generation protects late permission responses after stop/unmount.
export class QrCamera {
  private generation = 0
  private stream: MediaStream | null = null
  private timer: number | undefined
  private ended = () => { this.stop(); this.onError('La cámara se desconectó. Puedes activarla de nuevo o introducir el código manualmente.') }
  constructor(private video: HTMLVideoElement, private onDecode: (value: string) => void,
    private onError: (message: string) => void, private runtime: CameraRuntime = browserRuntime) {}

  async start(): Promise<boolean> {
    this.stop()
    const generation = this.generation
    try {
      const decode = await this.runtime.decoder()
      if (generation !== this.generation) return false
      const stream = await this.runtime.open()
      if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return false }
      this.stream = stream
      stream.getTracks().forEach(track => track.addEventListener('ended', this.ended))
      this.video.srcObject = stream
      await this.video.play()
      if (generation !== this.generation) return false
      const canvas = this.runtime.canvas()
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('unavailable')
      const frame = () => {
        if (generation !== this.generation) return
        if (this.video.readyState >= 2 && this.video.videoWidth && this.video.videoHeight) {
          const scale = Math.min(1, 640 / Math.max(this.video.videoWidth, this.video.videoHeight))
          canvas.width = Math.max(1, Math.round(this.video.videoWidth * scale))
          canvas.height = Math.max(1, Math.round(this.video.videoHeight * scale))
          let pixels: ImageData
          try {
            context.drawImage(this.video, 0, 0, canvas.width, canvas.height)
            pixels = context.getImageData(0, 0, canvas.width, canvas.height)
          } catch { this.stop(); this.onError('No se pudo leer la cámara. Utiliza el código manual.'); return }
          let value: string | undefined
          try { value = decode(pixels, { timeLimit: 12 }) }
          catch { /* A frame with no readable QR is normal; never log pixels or tokens. */ }
          if (value) { this.stop(); this.onDecode(value); return }
        }
        this.timer = this.runtime.schedule(frame)
      }
      this.timer = this.runtime.schedule(frame)
      return true
    } catch (error) {
      if (generation !== this.generation) return false
      this.stop()
      const denied = error && typeof error === 'object' && 'name' in error && ['NotAllowedError', 'PermissionDeniedError'].includes(String(error.name))
      this.onError(denied ? 'Permiso de cámara denegado. Introduce el enlace o código manualmente.' : 'No se pudo activar la cámara. Comprueba que uses HTTPS y una cámara disponible, o introduce el código manualmente.')
      return false
    }
  }
  stop() {
    this.generation++
    if (this.timer !== undefined) this.runtime.cancel(this.timer)
    this.timer = undefined
    this.stream?.getTracks().forEach(track => { track.removeEventListener('ended', this.ended); track.stop() })
    this.stream = null
    this.video.pause()
    this.video.srcObject = null
  }
}
