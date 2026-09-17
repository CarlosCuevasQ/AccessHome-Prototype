import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (key && !key.startsWith('sb_publishable_')) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY solo admite una clave sb_publishable_. No se incluirá esta configuración en el frontend.')
  }
  if (Object.keys(env).some((name) => !['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'].includes(name))) {
    throw new Error('AccessHome solo admite las dos variables VITE_* definidas en .env.example.')
  }
  return {
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  }
})
