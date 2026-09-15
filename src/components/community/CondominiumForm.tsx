import { useState } from 'react'
import type { Condominium } from '../../types/demo'
import { communityService } from '../../services/communityService'
import { EditorForm } from './EditorForm'

export function CondominiumForm({ condominium, onSaved, onCancel }: { condominium: Condominium; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(condominium.name)
  const [address, setAddress] = useState(condominium.address)
  return (
    <EditorForm title="Editar condominio" save={() => communityService.updateCondominium({ name, address })} onSaved={onSaved} onCancel={onCancel}>
      <label className="form-field">Nombre del condominio<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="form-field">Dirección<input required maxLength={200} value={address} onChange={(event) => setAddress(event.target.value)} /></label>
    </EditorForm>
  )
}
