import { Link } from 'react-router-dom'
import type { FrequentContact } from '../../types/contacts'

export function InviteLink({ contact, canManage }: { contact: FrequentContact; canManage: boolean }) {
  return contact.active && canManage
    ? <Link className="button-link" to={`/residente/contactos/${contact.id}/invitar`} aria-label={`Invitar a ${contact.name}`}>Invitar</Link>
    : <button className="button-link" disabled title={contact.active ? 'Residencia inactiva' : 'Reactiva el contacto para invitar'} aria-label={`Invitar a ${contact.name}`}>Invitar</button>
}
