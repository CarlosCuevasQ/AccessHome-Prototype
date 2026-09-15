import { useEffect, useRef } from 'react'
import type { Inhabitant, Vehicle } from '../../types/demo'
import { inhabitantName } from '../../utils/people'
import { ownerName } from './ResidenceTables'
import { DeleteAction } from '../DeleteAction'

type Detail = { person: Inhabitant; vehicle?: never } | { person?: never; vehicle: Vehicle }

export function HouseholdDetail({ person, vehicle, inhabitants, onEdit, onClose, onDelete, onDeleted }: Detail & { inhabitants: Inhabitant[]; onEdit?: () => void; onClose: () => void; onDelete?: () => Promise<void>; onDeleted?: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [person?.id, vehicle?.id])
  const fields = person ? [
    ['Nombre', inhabitantName(person)], ['Teléfono', person.phone || 'Sin registrar'],
    ['Correo de contacto', person.email || 'Sin registrar'], ['Relación o descripción', person.relationship || 'Sin especificar'],
    ['Estado', person.active ? 'Activo' : 'Inactivo'], ['Cuenta de acceso', person.userId ? 'Cuenta existente' : 'Sin cuenta'],
  ] : [
    ['Placas', vehicle.plates], ['Marca', vehicle.brand], ['Modelo', vehicle.model], ['Color', vehicle.color],
    ['Propietario principal', ownerName(inhabitants, vehicle.ownerId)], ['Estado', vehicle.active ? 'Activo' : 'Inactivo'],
  ]
  return <section className="record-detail" aria-label={person ? 'Detalle del habitante' : 'Detalle del vehículo'}>
    <h3 ref={heading} tabIndex={-1}>{person ? inhabitantName(person) : `${vehicle.brand} ${vehicle.model} · ${vehicle.plates}`}</h3>
    <dl className="detail-fields">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="form-actions">{onEdit && <button className="secondary-button" onClick={onEdit}>{person ? 'Editar habitante' : 'Editar vehículo'}</button>}<button className="text-button" onClick={onClose}>Cerrar detalle</button></div>
    {vehicle && onDelete && onDeleted && <DeleteAction key={vehicle.id} label={`Eliminar vehículo ${vehicle.plates}`} description={`Se eliminará ${vehicle.brand} ${vehicle.model} (${vehicle.plates}) del registro permanente de esta casa.`} onDelete={onDelete} onDeleted={onDeleted} />}
  </section>
}
