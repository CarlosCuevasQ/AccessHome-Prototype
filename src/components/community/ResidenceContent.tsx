import { useState } from 'react'
import type { ResidenceDetails } from '../../types/community'
import { ResidenceForm } from './ResidenceForm'
import { InhabitantForm } from './InhabitantForm'
import { VehicleForm } from './VehicleForm'
import { PrincipalForm } from './PrincipalForm'
import { HouseholdDetail } from './HouseholdDetail'
import { InhabitantsTable, VehiclesTable } from './ResidenceTables'
import { communityService } from '../../services/communityService'

type Editor = { type: 'residence' | 'principal' } | { type: 'inhabitant' | 'vehicle'; id?: string; editing: boolean } | null

export function ResidenceContent({ data, initialAction }: { data: ResidenceDetails; initialAction?: 'vehicle' | 'inhabitant' }) {
  const [editor, setEditor] = useState<Editor>(initialAction && data.permissions.manageHousehold ? { type: initialAction, editing: true } : null)
  const [message, setMessage] = useState('')
  const { residence, inhabitants, vehicles, primaryResident, permissions } = data
  const close = () => setEditor(null)
  const saved = () => { close(); setMessage('Cambios guardados correctamente.') }
  const open = (next: Editor) => { setMessage(''); setEditor(next) }
  const selectedPerson = editor?.type === 'inhabitant' ? inhabitants.find((person) => person.id === editor.id) : undefined
  const selectedVehicle = editor?.type === 'vehicle' ? vehicles.find((vehicle) => vehicle.id === editor.id) : undefined

  return (
    <>
      {message && <p className="form-success" role="status">{message}</p>}
      <div className="page-heading"><div><h1>{residence.name}</h1><p className="lead">{data.condominium.name} · {residence.street}</p></div>{permissions.manageStructure && <button className="secondary-button" onClick={() => open({ type: 'residence' })}>Editar residencia</button>}</div>
      <p className="muted">Residencia {residence.active ? 'activa' : 'inactiva'} · {data.condominium.address}</p>
      {!residence.active && <p className="access-notice">Esta residencia está inactiva. Sus datos se conservan para consulta; la administración puede reactivarla.</p>}
      {permissions.manageStructure && editor?.type === 'residence' && <ResidenceForm residence={residence} onSaved={saved} onCancel={close} />}
      <section className="principal-section" aria-labelledby="principal-heading">
        <div className="section-heading"><div><h2 id="principal-heading">Residente principal</h2><p>{primaryResident?.name ?? 'Sin asignar'}{primaryResident && <span className="cell-secondary">{primaryResident.email}</span>}</p></div>
          {permissions.manageStructure && <button className="secondary-button" onClick={() => open({ type: 'principal' })}>{primaryResident ? 'Cambiar residente principal' : 'Asignar residente principal'}</button>}
        </div>
        {permissions.manageStructure && editor?.type === 'principal' && <PrincipalForm data={data} onSaved={saved} onCancel={close} />}
        <p className="muted">{permissions.manageStructure ? 'El residente principal administra los habitantes y vehículos. La administración consulta esta información y gestiona la estructura de la residencia.' : permissions.manageHousehold ? 'Puedes gestionar los habitantes y vehículos de tu residencia. Para cambiar los datos de la casa, contacta a la administración.' : 'Tu acceso a esta residencia es de consulta. La gestión corresponde al residente principal de una residencia activa.'}</p>
      </section>
      <section className="community-section" aria-labelledby="inhabitants-heading">
        <div className="section-heading"><h2 id="inhabitants-heading">Habitantes <span className="count-label">{inhabitants.length}</span></h2>{permissions.manageHousehold && <button className="secondary-button" onClick={() => open({ type: 'inhabitant', editing: true })}>Agregar habitante</button>}</div>
        {editor?.type === 'inhabitant' && (editor.editing && permissions.manageHousehold
          ? <InhabitantForm key={editor.id ?? 'new-inhabitant'} residenceId={residence.id} inhabitant={selectedPerson} principal={!!selectedPerson?.userId && selectedPerson.userId === residence.principalUserId} onSaved={saved} onCancel={close} />
          : selectedPerson && <HouseholdDetail person={selectedPerson} inhabitants={inhabitants} onClose={close} onEdit={permissions.manageHousehold ? () => open({ ...editor, editing: true }) : undefined} />)}
        <InhabitantsTable inhabitants={inhabitants} principalUserId={residence.principalUserId} onView={(person) => open({ type: 'inhabitant', id: person.id, editing: false })} />
      </section>
      <section className="community-section" aria-labelledby="vehicles-heading">
        <div className="section-heading"><h2 id="vehicles-heading">Vehículos registrados <span className="count-label">{vehicles.length}</span></h2>{permissions.manageHousehold && <button className="secondary-button" onClick={() => open({ type: 'vehicle', editing: true })}>Registrar vehículo</button>}</div>
        {editor?.type === 'vehicle' && (editor.editing && permissions.manageHousehold
          ? <VehicleForm key={editor.id ?? 'new-vehicle'} residenceId={residence.id} inhabitants={inhabitants} vehicle={selectedVehicle} onSaved={saved} onCancel={close} />
          : selectedVehicle && <HouseholdDetail vehicle={selectedVehicle} inhabitants={inhabitants} onClose={close} onEdit={permissions.manageHousehold ? () => open({ ...editor, editing: true }) : undefined} onDelete={permissions.manageHousehold ? () => communityService.deleteVehicle(residence.id, selectedVehicle.id) : undefined} onDeleted={() => { close(); setMessage('Vehículo eliminado correctamente.') }} />)}
        <VehiclesTable vehicles={vehicles} inhabitants={inhabitants} onView={(vehicle) => open({ type: 'vehicle', id: vehicle.id, editing: false })} />
      </section>
    </>
  )
}
