import { useCallback } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import type { ContactAccess } from '../types/contacts'
import { contactsService } from '../services/contactsService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { ContactDetail } from '../components/contacts/ContactDetail'

export function ContactPage() {
  const { contactId = '' } = useParams()
  const { canManage } = useOutletContext<ContactAccess>()
  const load = useCallback(() => contactsService.getContact(contactId), [contactId])
  const { data, loading, error } = useCommunityQuery(load)
  usePageTitle(data?.name ?? 'Contacto')
  return <section className="community-page contacts-page">
    <p className="eyebrow">Residente / Contactos frecuentes</p>
    <Link className="back-link" to="/residente/contactos">Volver a contactos</Link>
    {loading && <p role="status">Cargando contacto…</p>}
    {error && <><h1>Contacto no disponible</h1><p className="form-error" role="alert">{error}</p></>}
    {data && <ContactDetail key={data.id} contact={data} canManage={canManage} />}
  </section>
}
