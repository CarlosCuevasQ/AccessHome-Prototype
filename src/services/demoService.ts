import { createDemoData, getDemoCredentials } from '../data/demo.js'
import { notifyDemoChange, readDemoData, writeDemoData } from './demoStorage.js'

export const demoService = {
  getCredentials: getDemoCredentials,

  async getProfileContext(userId: string) {
    const data = readDemoData()
    if (data.session?.userId !== userId) throw new Error('Inicia sesión para consultar tu perfil.')
    const user = data.users.find((account) => account.id === userId)
    if (!user) throw new Error('No se encontró el perfil.')
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
