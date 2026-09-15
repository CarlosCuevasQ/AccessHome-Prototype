import { useState } from 'react'
import type { Residence } from '../../types/demo'
import { communityService } from '../../services/communityService'
import { EditorForm } from './EditorForm'

export function ResidenceForm({ residence, onSaved, onCancel }: { residence?: Residence; onSaved: () => void; onCancel: () => void }) {
  const [number, setNumber] = useState(residence?.number ?? '')
  const [street, setStreet] = useState(residence?.street ?? '')
  const [active, setActive] = useState(residence?.active ?? true)
  const save = () => residence ? communityService.updateResidence(residence.id, { number, street, active }) : communityService.createResidence({ number, street, active })
  return (
    <EditorForm title={residence ? 'Editar residencia' : 'Agregar residencia'} save={save} onSaved={onSaved} onCancel={onCancel}>
      <label className="form-field">Número de casa<input type="number" min="1" max="99999" step="1" required value={number} onChange={(event) => setNumber(event.target.value)} /></label>
      <label className="form-field">Calle o circuito<input maxLength={100} required value={street} onChange={(event) => setStreet(event.target.value)} /></label>
      <label className="form-field">Estado de la residencia<select value={active ? 'active' : 'inactive'} onChange={(event) => setActive(event.target.value === 'active')}><option value="active">Activa</option><option value="inactive">Inactiva</option></select></label>
      <p className="form-help">Una residencia inactiva conserva sus registros y permite consultarlos. Su residente principal podrá gestionarlos cuando se reactive.</p>
    </EditorForm>
  )
}
