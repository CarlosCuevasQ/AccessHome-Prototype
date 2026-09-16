import { useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
  return <section className="community-page invitations-page">
    <p className="eyebrow">Residente / Invitaciones</p>
    <Link className="back-link" to={backPath}>{contactId ? 'Volver a contactos' : 'Volver a invitaciones'}</Link>
    <h1>{contactId ? 'Invitar a un contacto' : 'Nuevo visitante'}</h1>
    {loading && <p role="status">Cargando datos…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {data && <><p className="invitation-destination">Destino: <strong>{data.context.residenceName}</strong></p>
      <InvitationForm key={contactId ?? 'occasional'} contact={data.contact} onCancel={() => navigate(backPath)} onSaved={(id) => navigate(`/residente/invitaciones/${id}`, { replace: true, state: { created: true } })} />
    </>}
  </section>
}
