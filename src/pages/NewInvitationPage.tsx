import { Skeleton } from '../components/Skeleton'
import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ActionLink } from '../components/ActionLink'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { invitationsService } from '../services/invitationsService'
import { contactsService } from '../services/contactsService'
import { InvitationForm } from '../components/invitations/InvitationForm'

export function NewInvitationPage() {
  const { contactId } = useParams()
  const navigate = useNavigate()
  const load = useCallback(async () => {
    const context = await invitationsService.getContext()
    if (!context.canManage) throw new Error('Solo el residente principal de una residencia activa puede generar invitaciones.')
    const contact = contactId ? await contactsService.getContact(contactId) : undefined
    if (contact && !contact.active) throw new Error('Reactiva el contacto antes de generar una invitación.')
    return { context, contact }
  }, [contactId])
  const { data, error, loading } = useCommunityQuery(load)
  usePageTitle('Nueva invitación')
  const backPath = contactId ? '/residente/contactos' : '/residente/invitaciones'
  return <section className="community-page invitations-page resident-experience">
    <p className="eyebrow">Residente / Invitaciones</p>
    <ActionLink variant="back" to={backPath}>{contactId ? 'Volver a contactos' : 'Volver a invitaciones'}</ActionLink>
    <h1>{contactId ? 'Invitar a un contacto' : 'Nuevo visitante'}</h1>
    {loading && <Skeleton variant="form" label="Cargando datos…" />}
    {error && <p className="form-error" role="alert">{error}</p>}
    {data && <><p className="invitation-destination">Destino: <strong>{data.context.residenceName}</strong></p>
      <InvitationForm key={contactId ?? 'occasional'} contact={data.contact} onCancel={() => navigate(backPath)} onSaved={(id) => navigate(`/residente/invitaciones/${id}`, { replace: true, state: { created: true } })} />
    </>}
  </section>
}
