import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  const clientVariables = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']
  if (mode === 'shared') {
    if (!key || !env.VITE_SUPABASE_URL?.trim()) throw new Error('El despliegue requiere las dos variables públicas de Supabase. No se publicará una demo local.')
    let validUrl = false
    try {
      const url = new URL(env.VITE_SUPABASE_URL.trim())
      validUrl = url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash
    } catch { /* Fail without printing configuration. */ }
    if (!validUrl) throw new Error('El despliegue requiere la URL HTTPS del proyecto Supabase de ensayo.')
  }
  if (key && !key.startsWith('sb_publishable_')) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY solo admite una clave sb_publishable_. No se incluirá esta configuración en el frontend.')
  }
  if (Object.keys(env).some((name) => !clientVariables.includes(name) && !name.startsWith('VITE_VERCEL_'))) {
    throw new Error('AccessHome solo admite las dos variables VITE_* definidas en .env.example.')
  }
  return {
  // Vercel may inject VITE_VERCEL_* metadata. It is never included in the client.
  envPrefix: clientVariables,
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  }
})
