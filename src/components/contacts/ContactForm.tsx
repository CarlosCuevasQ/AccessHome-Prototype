import { useRef, useState } from 'react'
import type { FrequentContact } from '../../types/contacts'
import { contactsService } from '../../services/contactsService'
import { EditorForm } from '../community/EditorForm'

export function ContactForm({ contact, onSaved, onCancel }: { contact?: FrequentContact; onSaved: (id: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(contact?.name ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [notes, setNotes] = useState(contact?.notes ?? '')
  const [active, setActive] = useState(contact?.active ?? true)
  const savedId = useRef(contact?.id ?? '')
  const save = async () => {
    const input = { name, phone, email, notes, active }
    if (contact) await contactsService.updateContact(contact.id, input)
    else savedId.current = await contactsService.createContact(input)
  }
  return <EditorForm title={contact ? 'Editar contacto' : 'Nuevo contacto'} save={save} onSaved={() => onSaved(savedId.current)} onCancel={onCancel}>
    <label className="form-field">Nombre<input required maxLength={100} autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label className="form-field">Teléfono (opcional)<input type="tel" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
    <label className="form-field">Correo (opcional)<input type="email" maxLength={150} autoCapitalize="none" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label className="form-field">Notas (opcional)<textarea maxLength={1000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    {contact && <label className="form-field">Estado del contacto<select value={active ? 'active' : 'inactive'} onChange={(event) => setActive(event.target.value === 'active')}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>}
    <p className="form-help">{contact ? 'Desactivar conserva el contacto y sus vehículos. Puedes reactivarlo desde aquí.' : 'Después de guardar podrás registrar sus vehículos.'}</p>
  </EditorForm>
}
