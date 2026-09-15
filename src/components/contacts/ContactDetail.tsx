import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FrequentContact } from '../../types/contacts'
import { ContactForm } from './ContactForm'
import { ContactVehicleForm } from './ContactVehicleForm'
import { InviteLink } from './InviteLink'
import { DeleteAction } from '../DeleteAction'
import { contactsService } from '../../services/contactsService'

type Editor = { type: 'contact' } | { type: 'vehicle'; id?: string } | null

export function ContactDetail({ contact, canManage }: { contact: FrequentContact; canManage: boolean }) {
  const navigate = useNavigate()
  const [editor, setEditor] = useState<Editor>(null)
  const [message, setMessage] = useState('')
  const close = () => setEditor(null)
  const saved = () => { close(); setMessage('Cambios guardados correctamente.') }
  const open = (next: Editor) => { setMessage(''); setEditor(next) }
  const vehicle = editor?.type === 'vehicle' ? contact.vehicles.find((item) => item.id === editor.id) : undefined
  return <>
    {message && <p className="form-success" role="status">{message}</p>}
    <div className="page-heading"><div><h1>{contact.name}</h1><span className={`vehicle-status ${contact.active ? 'is-active' : ''}`}>{contact.active ? 'Activo' : 'Inactivo'}</span></div><InviteLink contact={contact} canManage={canManage} /></div>
    <p className="agenda-notice">Contacto de tu agenda privada. Este registro no autoriza el acceso al condominio.</p>
    {!canManage && <p className="access-notice">La residencia está inactiva; tu agenda está disponible para consulta.</p>}
    {canManage && <button className="secondary-button" onClick={() => open({ type: 'contact' })}>Editar contacto</button>}
    {editor?.type === 'contact' && canManage ? <ContactForm contact={contact} onSaved={saved} onCancel={close} /> : <dl className="detail-fields contact-fields">
      <div><dt>Teléfono</dt><dd>{contact.phone || 'Sin registrar'}</dd></div><div><dt>Correo</dt><dd>{contact.email || 'Sin registrar'}</dd></div><div className="contact-notes"><dt>Notas</dt><dd>{contact.notes || 'Sin notas'}</dd></div>
    </dl>}
    {!contact.active && <p className="muted">Contacto inactivo. Puedes reactivarlo en Editar contacto; sus vehículos se conservan.</p>}
    {canManage && <DeleteAction label="Eliminar contacto" description={`Se eliminará a ${contact.name} de tu agenda junto con los vehículos asociados (${contact.vehicles.length}).`} onDelete={() => contactsService.deleteContact(contact.id)} onDeleted={() => navigate('/residente/contactos', { replace: true, state: { contactDeleted: true } })} />}
    <section className="community-section" aria-labelledby="contact-vehicles-heading">
      <div className="section-heading"><h2 id="contact-vehicles-heading">Vehículos del contacto <span className="count-label">{contact.vehicles.length}</span></h2>{canManage && <button className="secondary-button" onClick={() => open({ type: 'vehicle' })}>Agregar vehículo</button>}</div>
      {editor?.type === 'vehicle' && canManage && <ContactVehicleForm key={editor.id ?? 'new'} contactId={contact.id} vehicle={vehicle} onSaved={saved} onCancel={close} />}
      {contact.vehicles.length ? <ul className="contact-list">{contact.vehicles.map((item) => <li className="contact-row" key={item.id}>
        <div className="contact-summary"><h3>{item.plates} <span className={`vehicle-status ${item.active ? 'is-active' : ''}`}>{item.active ? 'Activo' : 'Inactivo'}</span></h3><p>{[item.brand, item.model].filter(Boolean).join(' ') || 'Marca y modelo sin registrar'}</p><p className="muted">Color: {item.color || 'Sin registrar'}</p></div>
        {canManage && <div className="contact-vehicle-actions"><button className="secondary-button" aria-label={`Editar vehículo ${item.plates}`} onClick={() => open({ type: 'vehicle', id: item.id })}>Editar</button><DeleteAction label={`Eliminar vehículo ${item.plates}`} description={`Se eliminará el vehículo ${item.plates} de ${contact.name}.`} onDelete={() => contactsService.deleteVehicle(contact.id, item.id)} onDeleted={() => { close(); setMessage('Vehículo del contacto eliminado correctamente.') }} /></div>}
      </li>)}</ul> : <p className="empty-list">Sin vehículos registrados. Un contacto puede tener ninguno, uno o varios vehículos.</p>}
    </section>
  </>
}
