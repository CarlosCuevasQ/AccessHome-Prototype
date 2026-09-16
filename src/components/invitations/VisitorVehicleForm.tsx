import { useState } from 'react'
import type { VisitVehicle } from '../../types/invitations'
import { publicInvitationService } from '../../services/publicInvitationService'
import { EditorForm } from '../community/EditorForm'
import { VisitVehicleFields } from './VisitVehicleFields'

export function VisitorVehicleForm({ token, onSaved }: { token: string; onSaved: () => void }) {
  const [arrivesByCar, setArrivesByCar] = useState(false)
  const [vehicle, setVehicle] = useState<VisitVehicle>({ plates: '', brand: '', model: '', color: '' })
  return <section className="visitor-vehicle-section">
    <fieldset className="visitor-vehicle-choice">
      <legend>¿Llegarás en vehículo?</legend>
      <div className="visitor-vehicle-options">
        <label className="choice-label"><input type="radio" name="visitor-vehicle" checked={!arrivesByCar} onChange={() => setArrivesByCar(false)} />No</label>
        <label className="choice-label"><input type="radio" name="visitor-vehicle" checked={arrivesByCar} onChange={() => setArrivesByCar(true)} />Sí</label>
      </div>
    </fieldset>
    {arrivesByCar && <EditorForm
      title="Vehículo para esta visita" submitLabel="Guardar vehículo"
      save={() => publicInvitationService.addVehicle(token, vehicle)}
      onSaved={onSaved} onCancel={() => setArrivesByCar(false)}
    >
      <VisitVehicleFields value={vehicle} onChange={setVehicle} />
      <p className="form-help">Revisa las placas antes de guardar. Puedes añadir un vehículo una sola vez, antes de tu entrada. Quedará registrado únicamente para esta invitación.</p>
    </EditorForm>}
  </section>
}
