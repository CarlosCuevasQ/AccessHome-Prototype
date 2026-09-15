import { useState } from 'react'
import type { ContactVehicle } from '../../types/contacts'
import { contactsService } from '../../services/contactsService'
import { EditorForm } from '../community/EditorForm'

export function ContactVehicleForm({ contactId, vehicle, onSaved, onCancel }: { contactId: string; vehicle?: ContactVehicle; onSaved: () => void; onCancel: () => void }) {
  const [plates, setPlates] = useState(vehicle?.plates ?? '')
  const [brand, setBrand] = useState(vehicle?.brand ?? '')
  const [model, setModel] = useState(vehicle?.model ?? '')
  const [color, setColor] = useState(vehicle?.color ?? '')
  const [active, setActive] = useState(vehicle?.active ?? true)
  const save = () => {
    const input = { plates, brand, model, color, active }
    return vehicle ? contactsService.updateVehicle(contactId, vehicle.id, input) : contactsService.createVehicle(contactId, input)
  }
  return <EditorForm title={vehicle ? 'Editar vehículo del contacto' : 'Agregar vehículo al contacto'} save={save} onSaved={onSaved} onCancel={onCancel}>
    <label className="form-field">Placas<input required maxLength={15} autoCapitalize="characters" value={plates} onChange={(event) => setPlates(event.target.value)} /></label>
    <label className="form-field">Marca (opcional)<input maxLength={60} value={brand} onChange={(event) => setBrand(event.target.value)} /></label>
    <label className="form-field">Modelo (opcional)<input maxLength={60} value={model} onChange={(event) => setModel(event.target.value)} /></label>
    <label className="form-field">Color (opcional)<input maxLength={40} value={color} onChange={(event) => setColor(event.target.value)} /></label>
    <label className="form-field">Estado del vehículo<select value={active ? 'active' : 'inactive'} onChange={(event) => setActive(event.target.value === 'active')}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>
    <p className="form-help">Este vehículo pertenece al contacto, no al registro permanente de tu residencia. Desactivarlo conserva sus datos.</p>
  </EditorForm>
}
