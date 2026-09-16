import type { AccessHistoryFilters } from '../types/access.js'
import { readDemoData } from './demoStorage.js'
import { requireUser } from './communityRules.js'
import { filterAccessRecords, historyResidences, visibleAccessRecords } from './accessHistoryRules.js'

export const accessHistoryService = {
  async getContext() {
    const data = readDemoData()
    const user = requireUser(data)
    return { administrative: user.role === 'admin', residences: historyResidences(data, user)
      .sort((a, b) => Number(a.number) - Number(b.number)).map(({ id, name }) => ({ id, name })) }
  },
  async listRecords(filters: AccessHistoryFilters = {}) {
    const data = readDemoData()
    const user = requireUser(data)
    if (filters.residenceId && !historyResidences(data, user).some((house) => house.id === filters.residenceId)) throw new Error('No puedes consultar movimientos de otra residencia o condominio.')
    return filterAccessRecords(visibleAccessRecords(data, user), filters)
  },
}
