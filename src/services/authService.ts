import { sharedMode } from './shared/provider.js'
import { sharedAuth } from './shared/auth.js'
import type { LoginCredentials, SessionUser } from '../types/auth.js'
import type { DemoAccount } from '../types/demo.js'
import { notifyDemoChange, readDemoData, subscribeToDemoChanges, writeDemoData } from './demoStorage.js'
import { accountIsActive } from './communityRules.js'

export function sessionUser(account: DemoAccount): SessionUser {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    condominiumId: account.condominiumId,
    residenceId: account.residenceId,
  }
}

const localService = {
  async getSession(): Promise<SessionUser | null> {
    const data = readDemoData()
    const user = data.users.find((account) => account.id === data.session?.userId)
    return user && accountIsActive(data, user) ? sessionUser(user) : null
  },

  async login({ email }: LoginCredentials): Promise<SessionUser> {
    const data = readDemoData()
    const user = data.users.find((account) => account.email.toLowerCase() === email.trim().toLowerCase())
    if (!user) throw new Error('Cuenta local no encontrada.')
    if (!accountIsActive(data, user)) throw new Error('Este habitante está inactivo. Solicita su reactivación al residente principal.')
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

export const authService = sharedMode ? sharedAuth : localService

