import { createDemoData } from '../data/demo.js'
import type { DemoDatabase } from '../types/demo.js'
import { isDemoDatabase } from './demoValidation.js'

export const DEMO_STORAGE_KEY = 'accesshome.demo.v1'
const changeEvent = 'accesshome:demo-changed'

export function readDemoData(): DemoDatabase {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(DEMO_STORAGE_KEY)
  } catch {
    throw new Error('No se puede leer el almacenamiento local. Habilítalo en este navegador para usar la demostración.')
  }
  if (raw === null) {
    const initial = createDemoData()
    writeDemoData(initial)
    return initial
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isDemoDatabase(parsed)) return parsed
  } catch {
    // Los datos se conservan hasta que el usuario decida restaurarlos.
  }
  throw new Error('Los datos locales no son válidos. Restaura los datos demo para volver a entrar.')
}

export function writeDemoData(data: DemoDatabase): void {
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data))
  } catch {
    throw new Error('No se pudieron guardar los datos. Comprueba el espacio y los permisos de almacenamiento del navegador.')
  }
}

export function notifyDemoChange(): void {
  window.dispatchEvent(new Event(changeEvent))
}

export function subscribeToDemoChanges(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === DEMO_STORAGE_KEY || event.key === null) listener()
  }
  window.addEventListener(changeEvent, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(changeEvent, listener)
    window.removeEventListener('storage', onStorage)
  }
}
