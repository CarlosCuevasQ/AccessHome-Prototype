import { sharedMode } from './shared/provider.js'
import { sharedDashboard } from './shared/adapters.js'
import { readDemoData } from './demoStorage.js'
import { requireUser } from './communityRules.js'
import { requireInvitationUser, invitationStatus } from './invitationRules.js'
import { filterAccessRecords, visibleAccessRecords } from './accessHistoryRules.js'
import { visibleReports } from './reportRules.js'
import { localDateInput } from '../utils/dates.js'

const localService = {
  async getAdminDashboard() {
    const data = readDemoData()
    const user = requireUser(data, true)
    const houses = new Set(data.residences.filter((house) => house.condominiumId === user.condominiumId).map((house) => house.id))
    const now = Date.now()
    const today = localDateInput(new Date(now)).slice(0, 10)
    const records = visibleAccessRecords(data, user)
    return {
      condominium: data.condominiums.find((condo) => condo.id === user.condominiumId)!,
      residenceCount: houses.size,
      activeInhabitantCount: data.inhabitants.filter((person) => houses.has(person.residenceId) && person.active).length,
      vehicleCount: data.vehicles.filter((vehicle) => houses.has(vehicle.residenceId)).length,
      todayAccessCount: filterAccessRecords(records, { from: today, to: today }).length,
      activeInvitationCount: data.invitations.filter((invitation) => houses.has(invitation.residenceId) && invitationStatus(invitation, now) === 'activa').length,
      pendingReportCount: visibleReports(data, user).filter((report) => report.status === 'pendiente').length,
      recentAccess: records.slice(0, 5),
    }
  },
  async getResidentDashboard() {
    const data = readDemoData()
    const { user, residence, canManage } = requireInvitationUser(data)
    const now = Date.now()
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - 6)
    const records = visibleAccessRecords(data, user)
    return {
      residence, canManage, isPrincipal: residence.principalUserId === user.id,
      activeInvitationCount: data.invitations.filter((invitation) => invitation.residenceId === residence.id && invitationStatus(invitation, now) === 'activa').length,
      recentVisitCount: filterAccessRecords(records, { type: 'entrada', from: localDateInput(weekStart).slice(0, 10), to: localDateInput(new Date(now)).slice(0, 10) }).length,
      inhabitantCount: data.inhabitants.filter((person) => person.residenceId === residence.id).length,
      vehicleCount: data.vehicles.filter((vehicle) => vehicle.residenceId === residence.id).length,
      pendingReportCount: visibleReports(data, user).filter((report) => report.status === 'pendiente').length,
      recentAccess: records.slice(0, 5),
    }
  },
}

export const dashboardService = sharedMode ? sharedDashboard : localService
