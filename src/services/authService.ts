import type { LoginCredentials, SessionUser } from '../types/auth.js'
import type { DemoAccount } from '../types/demo.js'
import { notifyDemoChange, readDemoData, subscribeToDemoChanges, writeDemoData } from './demoStorage.js'

function sessionUser(account: DemoAccount): SessionUser {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    condominiumId: account.condominiumId,
    residenceId: account.residenceId,
  }
}

export const authService = {
  async getSession(): Promise<SessionUser | null> {
    const data = readDemoData()
    const user = data.users.find((account) => account.id === data.session?.userId)
    return user ? sessionUser(user) : null
  },

  async login({ email, password }: LoginCredentials): Promise<SessionUser> {
    const data = readDemoData()
    const user = data.users.find((account) => account.email.toLowerCase() === email.trim().toLowerCase() && account.password === password)
    if (!user) throw new Error('Correo o contraseña incorrectos.')
    data.session = { userId: user.id }
    writeDemoData(data)
    notifyDemoChange()
    return sessionUser(user)
  },

  async logout(): Promise<void> {
    const data = readDemoData()
    data.session = null
    writeDemoData(data)
    notifyDemoChange()
  },

  subscribe: subscribeToDemoChanges,
}
