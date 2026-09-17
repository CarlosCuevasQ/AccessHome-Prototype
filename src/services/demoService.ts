import { sharedMode } from './shared/provider.js'
import { sharedDemo } from './shared/adapters.js'
import { createDemoData, getDemoCredentials } from '../data/demo.js'
import { notifyDemoChange, readDemoData, writeDemoData } from './demoStorage.js'
import { requireUser } from './communityRules.js'

const localService = {
  getCredentials: getDemoCredentials,

  async getProfileContext(userId: string) {
    const data = readDemoData()
    if (data.session?.userId !== userId) throw new Error('Inicia sesión para consultar tu perfil.')
    const user = requireUser(data)
    return {
      condominium: data.condominiums.find((item) => item.id === user.condominiumId)!,
      residence: data.residences.find((item) => item.id === user.residenceId) ?? null,
    }
  },

  async resetDemoData(): Promise<void> {
    writeDemoData(createDemoData())
    notifyDemoChange()
  },
}

export const demoService = sharedMode ? sharedDemo : localService
