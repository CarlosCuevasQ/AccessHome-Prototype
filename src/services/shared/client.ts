import { createClient } from '@supabase/supabase-js'

const createConfiguredClient = (url: string, key: string) => createClient(url, key, { db: { schema: 'accesshome' }, auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
let client: ReturnType<typeof createConfiguredClient> | undefined
let publicClient: ReturnType<typeof createConfiguredClient> | undefined

function configuration() {
  const env = import.meta.env
  const url = env?.VITE_SUPABASE_URL?.trim()
  const key = env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !key) throw new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.local para conectar AccessHome.')
  if (!key.startsWith('sb_publishable_')) throw new Error('Utiliza una clave publishable de Supabase. No se admiten claves privilegiadas ni JWT heredados en Vite.')
  return { url, key }
}

export function getClient() {
  if (client) return client
  const { url, key } = configuration()
  client = createConfiguredClient(url, key)
  return client
}

export function getPublicClient() {
  if (publicClient) return publicClient
  const { url, key } = configuration()
  publicClient = createClient(url, key, { db: { schema: 'accesshome' }, auth: {
    persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'accesshome.public.anonymous',
  } })
  return publicClient
}
