import { useRef, useState } from 'react'
import type { FrequentContact } from '../../types/contacts'
import type { InvitationValidity, VisitVehicle, VisitVehicleChoice } from '../../types/invitations'
import { invitationsService } from '../../services/invitationsService'
import { localDateInput } from '../../utils/dates'
import { EditorForm } from '../community/EditorForm'
import { VisitVehicleFields } from './VisitVehicleFields'
import { ValidityFields } from './ValidityFields'

export function InvitationForm({ contact, onSaved, onCancel }: { contact?: FrequentContact; onSaved: (id: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saveAsContact, setSaveAsContact] = useState(false)
  const vehicles = contact?.vehicles.filter((vehicle) => vehicle.active) ?? []
  const [vehicleChoice, setVehicleChoice] = useState(vehicles[0]?.id ?? 'none')
  const [vehicle, setVehicle] = useState<VisitVehicle>({ plates: '', brand: '', model: '', color: '' })
  const [kind, setKind] = useState<InvitationValidity['kind']>('today')
  const [startsAt, setStartsAt] = useState(() => localDateInput(new Date()))
  const [expiresAt, setExpiresAt] = useState(() => localDateInput(new Date(Date.now() + 24 * 60 * 60 * 1000)))
  const savedId = useRef('')

  async function save() {
    const validity: InvitationValidity = kind === 'custom'
      ? { kind, startsAt: new Date(startsAt).toISOString(), expiresAt: new Date(expiresAt).toISOString() } : { kind }
    if (contact) {
      const choice: VisitVehicleChoice = vehicleChoice === 'none' ? { kind: 'none' }
        : vehicleChoice === 'other' ? { kind: 'other', vehicle } : { kind: 'saved', vehicleId: vehicleChoice }
      savedId.current = await invitationsService.createInvitation({ source: 'contact', contactId: contact.id, vehicleChoice: choice, validity })
    } else {
      savedId.current = await invitationsService.createInvitation({ source: 'occasional', visitorName: name, phone, vehicle: vehicleChoice === 'other' ? vehicle : null, saveAsContact, validity })
    }
  }

  return <EditorForm title="Datos de la visita" submitLabel="Generar invitación" save={save} onSaved={() => onSaved(savedId.current)} onCancel={onCancel}>
    {contact ? <div className="invitation-visitor"><h2>{contact.name}</h2><p>{contact.phone || 'Sin teléfono registrado'}</p><p className="form-help">Datos del contacto frecuente. Se guardará una copia con esta invitación.</p></div> : <>
      <label className="form-field">Nombre del visitante<input required maxLength={100} autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="form-field">Teléfono (opcional)<input type="tel" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
    </>}
    <fieldset className="invitation-fieldset">
      <legend>{contact ? 'Vehículo para esta visita' : '¿Llegará en vehículo?'}</legend>
      <div className="vehicle-options">
        {vehicles.map((item) => <label className="choice-label" key={item.id}><input type="radio" name="vehicle" checked={vehicleChoice === item.id} onChange={() => setVehicleChoice(item.id)} />{[item.brand, item.model].filter(Boolean).join(' ') || 'Vehículo'} · {item.plates}</label>)}
        <label className="choice-label"><input type="radio" name="vehicle" checked={vehicleChoice === 'none'} onChange={() => setVehicleChoice('none')} />{contact ? 'Sin vehículo' : 'No, sin vehículo'}</label>
        <label className="choice-label"><input type="radio" name="vehicle" checked={vehicleChoice === 'other'} onChange={() => setVehicleChoice('other')} />{contact ? 'Otro vehículo' : 'Sí, en vehículo'}</label>
      </div>
      {vehicleChoice === 'other' && <VisitVehicleFields value={vehicle} onChange={setVehicle} />}
    </fieldset>
    {!contact && <label className="choice-label save-contact-option"><input type="checkbox" checked={saveAsContact} onChange={(event) => setSaveAsContact(event.target.checked)} />Guardar como contacto frecuente</label>}
    <ValidityFields kind={kind} onKindChange={setKind} startsAt={startsAt} expiresAt={expiresAt} onStartChange={setStartsAt} onEndChange={setExpiresAt} />
    <p className="form-help">La invitación tendrá 2 usos disponibles. Una vez creada, podrás cancelarla y generar otra si necesitas corregir sus datos.</p>
  </EditorForm>
}
