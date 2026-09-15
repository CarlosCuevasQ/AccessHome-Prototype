import { useState } from 'react'
import type { Inhabitant } from '../../types/demo'
import { communityService } from '../../services/communityService'
import { EditorForm } from './EditorForm'

export function InhabitantForm({ residenceId, inhabitant, principal = false, onSaved, onCancel }: { residenceId: string; inhabitant?: Inhabitant; principal?: boolean; onSaved: () => void; onCancel: () => void }) {
  const [firstName, setFirstName] = useState(inhabitant?.firstName ?? '')
  const [lastName, setLastName] = useState(inhabitant?.lastName ?? '')
  const [email, setEmail] = useState(inhabitant?.email ?? '')
  const [phone, setPhone] = useState(inhabitant?.phone ?? '')
  const [relationship, setRelationship] = useState(inhabitant?.relationship ?? '')
  const [active, setActive] = useState(inhabitant?.active ?? true)
  const save = () => {
    const input = { firstName, lastName, email, phone, relationship, active }
    return inhabitant ? communityService.updateInhabitant(residenceId, inhabitant.id, input) : communityService.createInhabitant(residenceId, input)
  }
  return (
    <EditorForm title={inhabitant ? 'Editar habitante' : 'Agregar habitante'} save={save} onSaved={onSaved} onCancel={onCancel}>
      <label className="form-field">Nombre<input maxLength={60} required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
      <label className="form-field">Apellido<input maxLength={80} required value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
      <label className="form-field">Teléfono (opcional)<input type="tel" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
      <label className="form-field">Correo de contacto (opcional)<input type="email" maxLength={150} autoCapitalize="none" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label className="form-field">Relación o descripción (opcional)<input maxLength={100} value={relationship} onChange={(event) => setRelationship(event.target.value)} /></label>
      <label className="form-field">Estado del habitante<select disabled={principal} value={active ? 'active' : 'inactive'} onChange={(event) => setActive(event.target.value === 'active')}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>
      <p className="form-help">{principal ? 'Para desactivar al principal, el administrador debe asignar primero a otra persona.' : 'Puedes desactivar y reactivar al habitante conservando sus datos.'} El correo es de contacto; no crea ni cambia una cuenta de acceso.</p>
    </EditorForm>
  )
}
