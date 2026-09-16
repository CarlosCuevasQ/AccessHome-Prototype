// Solo para datos serializables en JSON, como la semilla y las migraciones.
export function cloneJsonData<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}
