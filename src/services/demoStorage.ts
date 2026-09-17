import { createDemoData } from '../data/demo.js'
import type { DemoDatabase } from '../types/demo.js'
import { isDemoDatabase, isLegacyDemoDatabase } from './demoValidation.js'
import { migrateDemoData } from './demoMigration.js'
import { sharedMode } from './shared/provider.js'

export const DEMO_STORAGE_KEY = 'accesshome.demo.v1'
const changeEvent = 'accesshome:demo-changed'

export function readDemoData(): DemoDatabase {
  if (sharedMode) throw new Error('El modo compartido no puede leer la base local.')
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
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { parsed = null }
  if (isDemoDatabase(parsed)) {
    if (parsed.users.some((user) => 'password' in user)) {
      for (const user of parsed.users) delete (user as unknown as Record<string, unknown>).password
      writeDemoData(parsed)
    }
    return parsed
  }
  if (isLegacyDemoDatabase(parsed)) {
    const migrated = migrateDemoData(parsed)
    if (isDemoDatabase(migrated)) {
      writeDemoData(migrated)
      return migrated
    }
  }
  throw new Error('Los datos locales no son válidos. Restaura los datos demo para volver a entrar.')
}

export function writeDemoData(data: DemoDatabase): void {
  if (sharedMode) throw new Error('El modo compartido no puede escribir la base local.')
  for (const user of data.users) delete (user as unknown as Record<string, unknown>).password
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data))
  } catch {
    throw new Error('No se pudieron guardar los datos. Comprueba el espacio y los permisos de almacenamiento del navegador.')
  }
}

export function notifyDemoChange(): void {
  window.dispatchEvent(new Event(changeEvent))
}

export function saveDemoData(data: DemoDatabase): void {
  writeDemoData(data)
  notifyDemoChange()
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
