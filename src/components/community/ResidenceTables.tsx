import type { Inhabitant, Vehicle } from '../../types/demo'
import { inhabitantName } from '../../utils/people'

export function InhabitantsTable({ inhabitants, principalUserId, onView }: { inhabitants: Inhabitant[]; principalUserId: string | null; onView: (person: Inhabitant) => void }) {
  if (!inhabitants.length) return <p className="empty-list">Esta residencia aún no tiene habitantes registrados.</p>
  return (
    <table className="data-table">
      <caption className="sr-only">Habitantes de la casa</caption>
      <thead><tr><th scope="col">Nombre</th><th scope="col">Relación</th><th scope="col">Estado</th><th scope="col">Detalle</th></tr></thead>
      <tbody>{inhabitants.map((person) => (
        <tr key={person.id}>
          <td data-label="Nombre">{inhabitantName(person)}{person.userId !== null && person.userId === principalUserId && <span className="principal-badge">Principal</span>}</td>
          <td data-label="Relación">{person.relationship || 'Sin especificar'}</td>
          <td data-label="Estado"><span className={`vehicle-status ${person.active ? 'is-active' : ''}`}>{person.active ? 'Activo' : 'Inactivo'}</span></td>
          <td data-label="Detalle"><button type="button" className="text-button" onClick={() => onView(person)} aria-label={`Ver a ${inhabitantName(person)}`}>Ver detalle</button></td>
        </tr>
      ))}</tbody>
    </table>
  )
}

export function VehiclesTable({ vehicles, inhabitants, onView }: { vehicles: Vehicle[]; inhabitants: Inhabitant[]; onView: (vehicle: Vehicle) => void }) {
  if (!vehicles.length) return <p className="empty-list">Esta residencia aún no tiene vehículos registrados.</p>
  return (
    <table className="data-table vehicles-table">
      <caption className="sr-only">Vehículos permanentes de la casa</caption>
      <thead><tr><th scope="col">Placas</th><th scope="col">Vehículo</th><th scope="col">Propietario principal</th><th scope="col">Estado</th><th scope="col">Detalle</th></tr></thead>
      <tbody>{vehicles.map((vehicle) => (
        <tr key={vehicle.id}>
          <td data-label="Placas"><strong>{vehicle.plates}</strong></td>
          <td data-label="Vehículo">{vehicle.brand} {vehicle.model}<span className="cell-secondary">{vehicle.color}</span></td>
          <td data-label="Propietario">{ownerName(inhabitants, vehicle.ownerId)}</td>
          <td data-label="Estado"><span className={`vehicle-status ${vehicle.active ? 'is-active' : ''}`}>{vehicle.active ? 'Activo' : 'Inactivo'}</span></td>
          <td data-label="Detalle"><button type="button" className="text-button" onClick={() => onView(vehicle)} aria-label={`Ver vehículo ${vehicle.plates}`}>Ver detalle</button></td>
        </tr>
      ))}</tbody>
    </table>
  )
}

export function ownerName(inhabitants: Inhabitant[], id: string | null) {
  const person = inhabitants.find((item) => item.id === id)
  return person ? `${inhabitantName(person)}${person.active ? '' : ' (inactivo)'}` : 'Sin asignar'
}
