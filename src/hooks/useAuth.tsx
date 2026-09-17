import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { authService } from '../services/authService'
import type { SessionUser } from '../types/auth'

interface AuthState {
  user: SessionUser | null
  loading: boolean
  error: string | null
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null })

  useEffect(() => {
    let request = 0
    let active = true
    const refresh = async () => {
      const current = ++request
      try {
        const user = await authService.getSession()
        if (active && current === request) setState({ user, loading: false, error: null })
      } catch (error) {
        if (active && current === request) {
          setState({ user: null, loading: false, error: error instanceof Error ? error.message : 'No se pudo recuperar la sesión.' })
        }
      }
    }
    const unsubscribe = authService.subscribe(() => { void refresh() })
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    void refresh()
    return () => { active = false; unsubscribe(); window.removeEventListener('focus', onFocus); window.removeEventListener('online', onFocus) }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth requiere AuthProvider.')
  return auth
}
