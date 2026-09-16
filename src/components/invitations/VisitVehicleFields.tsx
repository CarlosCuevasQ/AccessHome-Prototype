import type { VisitVehicle } from '../../types/invitations'

export function VisitVehicleFields({ value, onChange }: { value: VisitVehicle; onChange: (value: VisitVehicle) => void }) {
  const change = (field: keyof VisitVehicle, text: string) => onChange({ ...value, [field]: text })
  return <div className="visit-vehicle-fields">
    <label className="form-field">Placas<input required maxLength={15} autoCapitalize="characters" value={value.plates} onChange={(event) => change('plates', event.target.value)} /></label>
    <label className="form-field">Marca (opcional)<input maxLength={60} value={value.brand} onChange={(event) => change('brand', event.target.value)} /></label>
    <label className="form-field">Modelo (opcional)<input maxLength={60} value={value.model} onChange={(event) => change('model', event.target.value)} /></label>
    <label className="form-field">Color (opcional)<input maxLength={40} value={value.color} onChange={(event) => change('color', event.target.value)} /></label>
  </div>
}
