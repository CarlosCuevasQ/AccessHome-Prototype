import { sharedMode } from '../../services/shared/provider'
import { useState } from 'react'
import type { ResidenceDetails } from '../../types/community'
import { communityService } from '../../services/communityService'
import { inhabitantName } from '../../utils/people'
import { EditorForm } from './EditorForm'

export function PrincipalForm({ data, onSaved, onCancel }: { data: ResidenceDetails; onSaved: () => void; onCancel: () => void }) {
  const candidates = data.inhabitants.filter((person) => person.active && (!sharedMode || person.userId))
  const [selectedId, setSelectedId] = useState(candidates.find((person) => person.userId === data.residence.principalUserId)?.id ?? candidates[0]?.id ?? '')
  const [mode, setMode] = useState(candidates.length ? 'existing' : 'new')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const selected = candidates.find((person) => person.id === selectedId)
  const needsAccount = mode === 'new' || !selected?.userId
  const save = () => communityService.assignPrincipal(data.residence.id, mode === 'new'
    ? { firstName, lastName, email }
    : { inhabitantId: selectedId, loginEmail: email })
  if (sharedMode && candidates.length === 0) return <p className="form-help">Primero provisiona y vincula una cuenta a un habitante de esta casa mediante el procedimiento controlado.</p>
  return (
    <EditorForm title="Asignar residente principal" save={save} onSaved={onSaved} onCancel={onCancel}>
      <label className="form-field">Asignación<select value={mode} onChange={(event) => { setMode(event.target.value); setEmail('') }}>
        {candidates.length > 0 && <option value="existing">Habitante de esta residencia</option>}
        {!sharedMode && <option value="new">Nuevo residente principal</option>}
      </select></label>
      {mode === 'existing' ? <label className="form-field">Habitante<select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setEmail('') }}>{candidates.map((person) => <option key={person.id} value={person.id}>{inhabitantName(person)}</option>)}</select></label> : <>
        <label className="form-field">Nombre<input required maxLength={60} value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
        <label className="form-field">Apellido<input required maxLength={80} value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
      </>}
      {needsAccount && <label className="form-field">Correo de acceso<input type="email" autoCapitalize="none" required maxLength={150} value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
      <p className="form-help">{needsAccount ? 'Se creará una identidad local sin contraseña.' : 'Se conservará la cuenta de acceso de este habitante.'} El principal anterior permanecerá en la casa como habitante y dejará de poder gestionarla. No se trasladan personas desde otras casas.</p>
    </EditorForm>
  )
}

