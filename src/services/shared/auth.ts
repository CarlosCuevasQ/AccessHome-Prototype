import type { LoginCredentials, SessionUser } from '../../types/auth.js'
import { getClient } from './client.js'
import { rpc, notifySharedChange } from './transport.js'
import { clearSharedSession } from './adapters.js'

export const sharedAuth = {
  async getSession(): Promise<SessionUser | null> {
    const { data, error } = await getClient().auth.getSession()
    if (error) throw new Error('No se pudo recuperar la sesión.')
    if (!data.session) return null
    const profile = await rpc<Omit<SessionUser, 'email'> | null>('session_profile')
    if (!profile) throw new Error('Tu cuenta no tiene un perfil activo habilitado. Contacta al responsable de la demostración.')
    return { ...profile, email: data.session.user.email ?? '' }
  },
  async login({ email, password }: LoginCredentials): Promise<SessionUser> {
    const { error } = await getClient().auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new Error('No se pudo iniciar sesión. Revisa tu correo y contraseña o la conexión.')
    try {
      const user = await sharedAuth.getSession()
      if (!user) throw new Error('No se pudo iniciar sesión.')
      notifySharedChange()
      return user
    } catch (error) {
      await getClient().auth.signOut({ scope: 'local' })
      throw error
    }
  },
  async logout(): Promise<void> {
    const { error } = await getClient().auth.signOut({ scope: 'local' })
    if (error) throw new Error('No se pudo cerrar la sesión. Vuelve a intentarlo.')
    clearSharedSession()
    notifySharedChange()
  },
  subscribe(listener: () => void): () => void {
    try {
      let userId: string | null = null
      const { data } = getClient().auth.onAuthStateChange((event, session) => {
        const nextUserId = session?.user.id ?? null
        // SIGNED_IN also fires when the same session is recovered on tab focus.
        // Keep uncertain access retries until the identity actually changes.
        if (event === 'SIGNED_OUT' || nextUserId !== userId) clearSharedSession()
        userId = nextUserId
        // Defer SDK calls until the Auth callback releases its lock.
        setTimeout(() => { listener(); notifySharedChange() }, 0)
      })
      return () => data.subscription.unsubscribe()
    } catch { return () => {} }
  },
}
