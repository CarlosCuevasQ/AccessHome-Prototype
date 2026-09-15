import { useState } from 'react'
import type { Inhabitant, Vehicle } from '../../types/demo'
import { inhabitantName } from '../../utils/people'
import { communityService } from '../../services/communityService'
import { EditorForm } from './EditorForm'

interface VehicleFormProps {
  residenceId: string
  inhabitants: Inhabitant[]
  vehicle?: Vehicle
  onSaved: () => void
  onCancel: () => void
}

export function VehicleForm({ residenceId, inhabitants, vehicle, onSaved, onCancel }: VehicleFormProps) {
  const [plates, setPlates] = useState(vehicle?.plates ?? '')
  const [brand, setBrand] = useState(vehicle?.brand ?? '')
  const [model, setModel] = useState(vehicle?.model ?? '')
  const [color, setColor] = useState(vehicle?.color ?? '')
  const [active, setActive] = useState(vehicle?.active ?? true)
  const [ownerId, setOwnerId] = useState(vehicle?.ownerId ?? '')
  const save = () => {
    const input = { plates, brand, model, color, active, ownerId: ownerId || null }
    return vehicle ? communityService.updateVehicle(residenceId, vehicle.id, input) : communityService.createVehicle(residenceId, input)
  }
  return (
    <EditorForm title={vehicle ? 'Editar vehículo' : 'Registrar vehículo'} save={save} onSaved={onSaved} onCancel={onCancel}>
      <label className="form-field">Placas<input required maxLength={15} autoCapitalize="characters" value={plates} onChange={(event) => setPlates(event.target.value)} /></label>
      <label className="form-field">Marca<input required maxLength={60} value={brand} onChange={(event) => setBrand(event.target.value)} /></label>
      <label className="form-field">Modelo<input required maxLength={60} value={model} onChange={(event) => setModel(event.target.value)} /></label>
      <label className="form-field">Color<input required maxLength={40} value={color} onChange={(event) => setColor(event.target.value)} /></label>
      <label className="form-field">Estado<select value={active ? 'active' : 'inactive'} onChange={(event) => setActive(event.target.value === 'active')}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>
      <label className="form-field">Propietario principal (opcional)<select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">Sin asignar</option>{inhabitants.map((person) => <option key={person.id} value={person.id}>{inhabitantName(person)}{person.active ? '' : ' (inactivo)'}</option>)}</select></label>
      <p className="form-help">El vehículo pertenece a esta residencia. Puedes desactivarlo sin perder sus datos.</p>
    </EditorForm>
  )
}
