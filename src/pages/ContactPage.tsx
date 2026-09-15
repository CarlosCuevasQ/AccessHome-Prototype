import { useCallback } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import type { ContactAccess } from '../types/contacts'
import { contactsService } from '../services/contactsService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { ContactDetail } from '../components/contacts/ContactDetail'

export function ContactPage({ invitation = false }: { invitation?: boolean }) {
  const { contactId = '' } = useParams()
  const { canManage } = useOutletContext<ContactAccess>()
  const load = useCallback(() => contactsService.getContact(contactId), [contactId])
  const { data, loading, error } = useCommunityQuery(load)
  usePageTitle(invitation ? 'Invitar · Próxima etapa' : data?.name ?? 'Contacto')
  return <section className="community-page contacts-page">
    <p className="eyebrow">Residente / Contactos frecuentes</p>
    <Link className="back-link" to="/residente/contactos">Volver a contactos</Link>
    {loading && <p role="status">Cargando contacto…</p>}
    {error && <><h1>Contacto no disponible</h1><p className="form-error" role="alert">{error}</p></>}
    {data && (invitation ? <>
      <h1>Invitar a {data.name}</h1>
      <p className="status-badge">Próxima etapa</p>
      <p className="lead">La creación de invitaciones todavía no está disponible. No se ha generado ninguna invitación ni autorización de acceso.</p>
      {(!data.active || !canManage) && <p className="access-notice">El contacto y tu residencia deben estar activos para preparar una invitación.</p>}
      <Link className="secondary-button" to={`/residente/contactos/${data.id}`}>Volver al contacto</Link>
    </> : <ContactDetail key={data.id} contact={data} canManage={canManage} />)}
  </section>
}
