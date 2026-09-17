import type { CondominiumInput, CondominiumSummary, ResidenceDetails, ResidenceInput, ResidenceSummary, InhabitantInput, VehicleInput, PrincipalInput } from '../../types/community.js'
import type { ContactAccess, ContactInput, ContactVehicleInput, FrequentContact } from '../../types/contacts.js'
import type { Invitation, InvitationContext, InvitationInput, InvitationStatus, PublicInvitation, VisitVehicle } from '../../types/invitations.js'
import type { AccessHistoryFilters, AccessInvitationOption, AccessRecord, AccessResult } from '../../types/access.js'
import type { Report, ReportInput, ReportStatus } from '../../types/reports.js'
import type { Condominium, Residence } from '../../types/demo.js'
import { rpc, subscribeShared } from './transport.js'
import { generateId } from '../../utils/id.js'

const household = (operation: string, residenceId: string, target: string | null, input: unknown) =>
  rpc<void>('manage_household', { operation, residence_id: residenceId, target, input }, true)
export const sharedHousehold = {
  createInhabitant: (residenceId: string, input: InhabitantInput) => household('create_inhabitant', residenceId, null, input),
  updateInhabitant: (residenceId: string, id: string, input: InhabitantInput) => household('update_inhabitant', residenceId, id, input),
  createVehicle: (residenceId: string, input: VehicleInput) => household('create_vehicle', residenceId, null, input),
  updateVehicle: (residenceId: string, id: string, input: VehicleInput) => household('update_vehicle', residenceId, id, input),
  deleteVehicle: (residenceId: string, id: string) => household('delete_vehicle', residenceId, id, {}),
}
export async function sharedAssignPrincipal(residenceId: string, input: PrincipalInput): Promise<void> {
  if (!('inhabitantId' in input)) throw new Error('Primero provisiona y vincula la cuenta mediante el procedimiento controlado.')
  await rpc('assign_principal', { residence_id: residenceId, inhabitant_id: input.inhabitantId }, true)
}
export const sharedCommunity = {
  ...sharedHousehold, assignPrincipal: sharedAssignPrincipal, subscribe: subscribeShared,
  getSummary: () => rpc<CondominiumSummary>('community_summary'),
  listResidences: (search = '') => rpc<ResidenceSummary[]>('list_residences', { search }),
  getResidence: (id?: string) => rpc<ResidenceDetails>('residence_details', { target: id ?? null }),
  updateCondominium: (input: CondominiumInput) => rpc<void>('manage_community', { operation: 'condominium', target: null, input }, true),
  createResidence: (input: ResidenceInput) => rpc<string>('manage_community', { operation: 'create_residence', target: null, input }, true),
  updateResidence: (id: string, input: ResidenceInput) => rpc<void>('manage_community', { operation: 'update_residence', target: id, input }, true),
}
const contact = <T>(operation: string, target: string | null, input: unknown, contactId: string | null = null) =>
  rpc<T>('manage_contact', { operation, target, input, contact_id: contactId }, true)
export const sharedContacts = {
  subscribe: subscribeShared,
  getAccess: () => rpc<ContactAccess>('contact_access'),
  listContacts: (search = '') => rpc<FrequentContact[]>('list_contacts', { search }),
  getContact: (id: string) => rpc<FrequentContact>('contact_details', { target: id }),
  createContact: (input: ContactInput) => contact<string>('create', null, input),
  updateContact: (id: string, input: ContactInput) => contact<void>('update', id, input),
  deleteContact: (id: string) => contact<void>('delete', id, {}),
  createVehicle: (contactId: string, input: ContactVehicleInput) => contact<void>('create_vehicle', null, input, contactId),
  updateVehicle: (contactId: string, id: string, input: ContactVehicleInput) => contact<void>('update_vehicle', id, input, contactId),
  deleteVehicle: (contactId: string, id: string) => contact<void>('delete_vehicle', id, {}, contactId),
}
export const sharedInvitations = {
  subscribe: subscribeShared,
  getContext: () => rpc<InvitationContext>('invitation_context'),
  listInvitations: (search = '', status: InvitationStatus | 'todas' = 'todas') => rpc<Invitation[]>('list_invitations', { search, status_filter: status }),
  getInvitation: (id: string) => rpc<Invitation>('invitation_details', { target: id }),
  createInvitation: (input: InvitationInput) => rpc<string>('create_invitation', { input }, true),
  cancelInvitation: (id: string) => rpc<void>('cancel_invitation', { target: id }, true),
}
export const sharedPublicInvitation = {
  async getInvitation(token: string): Promise<PublicInvitation> {
    const invitation = await rpc<PublicInvitation | null>('public_invitation', { token, vehicle: null })
    if (!invitation) throw new Error('Invitación no disponible. Comprueba el enlace con tu anfitrión.')
    return invitation
  },
  async addVehicle(token: string, vehicle: VisitVehicle): Promise<void> {
    if (!await rpc('public_invitation', { token, vehicle }, true)) throw new Error('Invitación no disponible.')
  },
}
export const sharedReports = {
  getContext: () => rpc<{ administrative: boolean; residenceName: string | undefined; canCreate: boolean }>('report_context'),
  listReports: () => rpc<Report[]>('list_reports'),
  getReport: (id: string) => rpc<Report>('report_details', { target: id }),
  createReport: (input: ReportInput) => rpc<string>('create_report', { input }, true),
  updateStatus: (id: string, status: ReportStatus) => rpc<void>('advance_report', { target: id, next_status: status }, true),
}
export const sharedHistory = {
  getContext: () => rpc<{ administrative: boolean; residences: { id: string; name: string }[] }>('history_context'),
  listRecords: (filters: AccessHistoryFilters = {}) => rpc<AccessRecord[]>('list_access', { filters }),
}
let retry: { token: string; requestId: string } | null = null
export function clearSharedSession() { retry = null }
export const sharedAccess = {
  listActiveInvitations: () => rpc<AccessInvitationOption[]>('active_access_invitations'),
  listAccessRecords: () => rpc<AccessRecord[]>('list_access', { filters: {} }),
  async validateToken(token: string): Promise<AccessResult> {
    const normalized = token.trim()
    if (retry?.token !== normalized) retry = { token: normalized, requestId: generateId() }
    const result = await rpc<AccessResult>('validate_access', { token: normalized, request_id: retry.requestId }, true)
    retry = null
    return result
  },
}
interface CommonDashboard { activeInvitationCount: number; vehicleCount: number; pendingReportCount: number; recentAccess: AccessRecord[] }
export const sharedDashboard = {
  getAdminDashboard: () => rpc<CommonDashboard & { condominium: Condominium; residenceCount: number; activeInhabitantCount: number; todayAccessCount: number }>('admin_dashboard'),
  getResidentDashboard: () => rpc<CommonDashboard & { residence: Residence; canManage: boolean; isPrincipal: boolean; recentVisitCount: number; inhabitantCount: number }>('resident_dashboard'),
}
export const sharedDemo = {
  getCredentials: () => [],
  getProfileContext: (userId: string) => rpc<{ condominium: Condominium; residence: Residence | null }>('profile_context', { target_user: userId }),
  async resetDemoData(): Promise<void> { throw new Error('No se pueden restaurar datos compartidos desde el navegador.') },
}
