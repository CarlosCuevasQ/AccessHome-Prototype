import { getClient, getPublicClient } from './client.js'

const listeners = new Set<() => void>()
export function notifySharedChange() { listeners.forEach((listener) => listener()) }
export function subscribeShared(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function backendError(error: { code?: string; message: string }): Error {
  if (error.code === '23505') return new Error('Ya existe un registro con esos datos.')
  if (error.code === '23503') return new Error('La relación seleccionada no es válida o el registro tiene información relacionada.')
  if (error.code?.startsWith('22') || error.code === '23514' || error.code === '23502') return new Error('Revisa los campos, sus límites y las fechas.')
  if (error.code === '42501') return new Error('No tienes permiso para esta operación. Comprueba tu cuenta y residencia.')
  return new Error(error.message || 'No se pudo contactar con el servidor. Vuelve a consultar antes de reintentar.')
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
