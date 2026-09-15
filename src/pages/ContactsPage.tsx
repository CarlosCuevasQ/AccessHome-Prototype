import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import type { ContactAccess } from '../types/contacts'
import { contactsService } from '../services/contactsService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { ContactForm } from '../components/contacts/ContactForm'
import { InviteLink } from '../components/contacts/InviteLink'

export function ContactsPage() {
  usePageTitle('Contactos frecuentes')
  const navigate = useNavigate()
  const location = useLocation()
  const { canManage } = useOutletContext<ContactAccess>()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const load = useCallback(() => contactsService.listContacts(search), [search])
  const { data, error, loading } = useCommunityQuery(load)
  return <section className="community-page contacts-page">
    <p className="eyebrow">Residente / Agenda privada</p>
    {location.state?.contactDeleted === true && <p className="form-success" role="status">Contacto eliminado correctamente.</p>}
    <div className="page-heading"><div><h1>Contactos frecuentes</h1><p className="lead">Guarda a tus visitantes habituales y sus vehículos.</p></div>{canManage && <button className="button-link" onClick={() => setCreating(true)}>Nuevo contacto</button>}</div>
    <p className="agenda-notice">Guardar un contacto no concede acceso permanente al condominio. Las invitaciones se habilitarán en la siguiente etapa.</p>
    {!canManage && <p className="access-notice">Tu residencia está inactiva. Puedes consultar tu agenda; solicita su reactivación para gestionarla.</p>}
    {creating && canManage && <ContactForm onSaved={(id) => navigate(`/residente/contactos/${id}`)} onCancel={() => setCreating(false)} />}
    <label className="form-field contact-search">Buscar contacto<input type="search" placeholder="Nombre, teléfono, correo o placas" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && <p role="status">Cargando contactos…</p>}
    {data && <><p className="result-count" role="status">{data.length} {data.length === 1 ? 'contacto encontrado' : 'contactos encontrados'}</p>
      {data.length ? <ul className="contact-list">{data.map((contact) => <li key={contact.id} className="contact-row">
        <div className="contact-summary"><h2>{contact.name} {!contact.active && <span className="vehicle-status">Inactivo</span>}</h2>
          {contact.vehicles.length ? <ul className="contact-vehicles-preview">{contact.vehicles.map((vehicle) => <li key={vehicle.id}>{[vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Vehículo'} · {vehicle.plates}{!vehicle.active && ' · Inactivo'}</li>)}</ul> : <p className="muted">Sin vehículos registrados</p>}
        </div>
        <div className="contact-actions"><Link className="secondary-button" to={`/residente/contactos/${contact.id}`} aria-label={`Ver a ${contact.name}`}>Ver</Link><InviteLink contact={contact} canManage={canManage} /></div>
      </li>)}</ul> : <p className="empty-list">{search ? 'No hay contactos que coincidan con tu búsqueda.' : 'Tu agenda está vacía. Crea tu primer contacto.'}</p>}
    </>}
  </section>
}
