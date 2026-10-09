import { useRef, useState } from 'react'
import { Icon } from '../Icon'
import { FadeContent } from '../react-bits/FadeContent'
import type { ResidenceDetails } from '../../types/community'
import { ResidenceForm } from './ResidenceForm'
import { InhabitantForm } from './InhabitantForm'
import { VehicleForm } from './VehicleForm'
import { PrincipalForm } from './PrincipalForm'
import { HouseholdDetail } from './HouseholdDetail'
import { InhabitantsTable, VehiclesTable } from './ResidenceTables'
import { communityService } from '../../services/communityService'

type Editor = { type: 'residence' | 'principal' } | { type: 'inhabitant' | 'vehicle'; id?: string; editing: boolean } | null

export function ResidenceContent({ data, initialAction, residentView = false }: { data: ResidenceDetails; initialAction?: 'vehicle' | 'inhabitant'; residentView?: boolean }) {
  const [editor, setEditor] = useState<Editor>(initialAction && data.permissions.manageHousehold ? { type: initialAction, editing: true } : null)
  const [message, setMessage] = useState('')
  const trigger = useRef<HTMLElement | null>(null)
  const { residence, inhabitants, vehicles, primaryResident, permissions } = data
  const close = () => { setEditor(null); trigger.current?.focus() }
  const saved = () => { close(); setMessage('Cambios guardados correctamente.') }
  const open = (next: Editor) => {
    const focused = document.activeElement
    if (focused instanceof HTMLElement && !focused.closest('.record-detail, .editor-form')) trigger.current = focused
    setMessage(''); setEditor(next)
  }
  const selectedPerson = editor?.type === 'inhabitant' ? inhabitants.find((person) => person.id === editor.id) : undefined
  const selectedVehicle = editor?.type === 'vehicle' ? vehicles.find((vehicle) => vehicle.id === editor.id) : undefined

  return (
    <>
      {message && <p className="form-success" role="status">{message}</p>}
      {residentView ? <FadeContent className="residence-identity"><header><div className="entity-symbol"><Icon name="home" /></div><div><p className="eyebrow">Tu hogar</p><h1>{residence.name}</h1><p className="lead">{data.condominium.name}</p><p className="muted">{residence.street} · {data.condominium.address}</p></div><span className={`vehicle-status ${residence.active ? 'is-active' : ''}`}>{residence.active ? 'Residencia activa' : 'Residencia inactiva'}</span></header></FadeContent>
        : <><div className="page-heading"><div><h1>{residence.name}</h1><p className="lead">{data.condominium.name} · {residence.street}</p></div>{permissions.manageStructure && <button className="secondary-button" onClick={() => open({ type: 'residence' })}>Editar residencia</button>}</div><p className="muted">Residencia {residence.active ? 'activa' : 'inactiva'} · {data.condominium.address}</p></>}
      {!residence.active && <p className="access-notice">Esta residencia está inactiva. Sus datos se conservan para consulta; la administración puede reactivarla.</p>}
      {permissions.manageStructure && editor?.type === 'residence' && <ResidenceForm residence={residence} onSaved={saved} onCancel={close} />}
      <section className="principal-section" aria-labelledby="principal-heading">
        <div className="section-heading"><div><h2 id="principal-heading">Residente principal</h2><p className="principal-name">{primaryResident?.name ?? 'Sin asignar'}{primaryResident && <span className="cell-secondary">{primaryResident.email}</span>}</p></div>
          {permissions.manageStructure && <button className="secondary-button" onClick={() => open({ type: 'principal' })}>{primaryResident ? 'Cambiar residente principal' : 'Asignar residente principal'}</button>}
        </div>
        {permissions.manageStructure && editor?.type === 'principal' && <PrincipalForm data={data} onSaved={saved} onCancel={close} />}
        <p className="muted">{permissions.manageStructure ? 'El residente principal administra los habitantes y vehículos. La administración consulta esta información y gestiona la estructura de la residencia.' : permissions.manageHousehold ? 'Puedes gestionar los habitantes y vehículos de tu residencia. Para cambiar los datos de la casa, contacta a la administración.' : 'Tu acceso a esta residencia es de consulta. La gestión corresponde al residente principal de una residencia activa.'}</p>
      </section>
      <div className={residentView ? 'resident-household-grid' : undefined}>
      <section className="community-section" aria-labelledby="inhabitants-heading">
        <div className="section-heading"><h2 id="inhabitants-heading">Habitantes <span className="count-label">{inhabitants.length}</span></h2>{permissions.manageHousehold && <button className="secondary-button" onClick={() => open({ type: 'inhabitant', editing: true })}>{residentView && <Icon name="plus" />}Agregar habitante</button>}</div>
        {editor?.type === 'inhabitant' && (editor.editing && permissions.manageHousehold
          ? <InhabitantForm key={editor.id ?? 'new-inhabitant'} residenceId={residence.id} inhabitant={selectedPerson} principal={!!selectedPerson?.userId && selectedPerson.userId === residence.principalUserId} onSaved={saved} onCancel={close} />
          : selectedPerson && <HouseholdDetail person={selectedPerson} inhabitants={inhabitants} onClose={close} onEdit={permissions.manageHousehold ? () => open({ ...editor, editing: true }) : undefined} />)}
        <InhabitantsTable presentation={residentView ? 'rows' : 'table'} inhabitants={inhabitants} principalUserId={residence.principalUserId} onView={(person) => open({ type: 'inhabitant', id: person.id, editing: false })} />
      </section>
      <section className="community-section" aria-labelledby="vehicles-heading">
        <div className="section-heading"><h2 id="vehicles-heading">Vehículos registrados <span className="count-label">{vehicles.length}</span></h2>{permissions.manageHousehold && <button className="secondary-button" onClick={() => open({ type: 'vehicle', editing: true })}>{residentView && <Icon name="plus" />}Registrar vehículo</button>}</div>
        {editor?.type === 'vehicle' && (editor.editing && permissions.manageHousehold
          ? <VehicleForm key={editor.id ?? 'new-vehicle'} residenceId={residence.id} inhabitants={inhabitants} vehicle={selectedVehicle} onSaved={saved} onCancel={close} />
          : selectedVehicle && <HouseholdDetail vehicle={selectedVehicle} inhabitants={inhabitants} onClose={close} onEdit={permissions.manageHousehold ? () => open({ ...editor, editing: true }) : undefined} onDelete={permissions.manageHousehold ? () => communityService.deleteVehicle(residence.id, selectedVehicle.id) : undefined} onDeleted={() => { close(); setMessage('Vehículo eliminado correctamente.') }} />)}
        <VehiclesTable presentation={residentView ? 'rows' : 'table'} vehicles={vehicles} inhabitants={inhabitants} onView={(vehicle) => open({ type: 'vehicle', id: vehicle.id, editing: false })} />
      </section>
      </div>
    </>
  )
}
