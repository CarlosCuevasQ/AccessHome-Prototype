import { getClient, getPublicClient } from './client.js'

const listeners = new Set<() => void>()
export function notifySharedChange() { listeners.forEach((listener) => listener()) }
export function subscribeShared(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

// Only AccessHome's own RAISE messages (P0001) are written for the UI. Any other
// PostgreSQL/PostgREST/fetch text may name tables, functions or constraints.
export function backendError(error: { code?: string; message: string }): Error {
  const code = error.code ?? ''
  if (code === 'P0001' && error.message) return new Error(error.message)
  if (code === '23505') return new Error('Ya existe un registro con esos datos.')
  if (code === '23503') return new Error('La relación seleccionada no es válida o el registro tiene información relacionada.')
  if (code.startsWith('22') || code.startsWith('23')) return new Error('Revisa los campos, sus límites y las fechas.')
  if (code === '42501') return new Error('No tienes permiso para esta operación. Comprueba tu cuenta y residencia.')
  if (code === '40001' || code === '40P01') return new Error('Otra operación cambió estos datos al mismo tiempo. Actualiza la información antes de reintentar.')
  if (code === '57014' || code === '55P03') return new Error('El servidor tardó demasiado en responder. Vuelve a consultar antes de reintentar.')
  if (!code) return new Error('No se pudo contactar con el servidor. Vuelve a consultar antes de reintentar.')
  return new Error('No se pudo completar la operación. Vuelve a consultar antes de reintentar.')
}

async function request<T>(client: ReturnType<typeof getClient>, name: string, args: Record<string, unknown>, writing: boolean): Promise<T> {
  const { data, error } = await client.rpc(name, args)
  if (error) throw backendError(error)
  if (data && typeof data === 'object' && 'error' in data) throw new Error(String(data.error))
  if (writing) notifySharedChange()
  return data as T
}

export const rpc = <T>(name: string, args: Record<string, unknown> = {}, writing = false) => request<T>(getClient(), name, args, writing)
export const publicRpc = <T>(args: Record<string, unknown>, writing = false) => request<T>(getPublicClient(), 'public_invitation', args, writing)
