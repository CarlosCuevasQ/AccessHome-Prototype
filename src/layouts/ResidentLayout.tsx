import { WorkspaceLayout } from './WorkspaceLayout'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { contactsService } from '../services/contactsService'

export function ResidentLayout() {
  const { data } = useCommunityQuery(contactsService.getAccess)
  return <WorkspaceLayout role="resident" showContacts={data !== null} />
}
