import { sharedMode } from '../services/shared/provider'
import { useCallback } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { invitationsService } from '../services/invitationsService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { formatDate } from '../utils/dates'
import { InvitationStatusLabel } from '../components/invitations/InvitationStatusLabel'
import { CancelInvitation } from '../components/invitations/CancelInvitation'
import { InvitationQr } from '../components/invitations/InvitationQr'
import { invitationPath } from '../utils/invitationLinks'

export function InvitationPage() {
  const { invitationId = '' } = useParams()
  const location = useLocation()
  const load = useCallback(async () => ({ context: await invitationsService.getContext(), invitation: await invitationsService.getInvitation(invitationId) }), [invitationId])
  const { data, loading, error } = useCommunityQuery(load, 1000)
  const invitation = data?.invitation
  usePageTitle(invitation ? `Invitación · ${invitation.visitorName}` : 'Invitación')
  return <section className="community-page invitations-page">
    <p className="eyebrow">Residente / Invitaciones</p>
    <Link className="back-link" to="/residente/invitaciones">Volver a invitaciones</Link>
    <h1>Detalle de invitación</h1>
    {loading && <p role="status">Cargando invitación…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {invitation && <>
      {location.state?.created === true && <p className="form-success" role="status">Invitación creada correctamente para {invitation.residenceName}.</p>}
      <div className="section-heading"><h2>{invitation.visitorName}</h2><InvitationStatusLabel status={invitation.status} /></div>
      {invitation.status === 'activa' && Date.parse(invitation.startsAt) > Date.now() && <p className="agenda-notice">Visita programada. Su vigencia comenzará el {formatDate(invitation.startsAt)}</p>}
      <dl className="detail-fields">
        <div><dt>Residencia destino</dt><dd>{invitation.residenceName}</dd></div><div><dt>Invita</dt><dd>{invitation.inviterName}</dd></div>
        <div><dt>Teléfono</dt><dd>{invitation.phone || 'No registrado'}</dd></div><div><dt>Usos utilizados</dt><dd>{invitation.usedUses} de {invitation.maxUses}</dd></div>
        <div><dt>Inicio</dt><dd>{formatDate(invitation.startsAt)}</dd></div><div><dt>Expiración</dt><dd>{formatDate(invitation.expiresAt)}</dd></div>
        <div><dt>Creada el</dt><dd>{formatDate(invitation.createdAt)}</dd></div><div><dt>Identificador de invitación</dt><dd>{invitation.token}</dd></div>
      </dl>
      <section className="community-section"><h2>Vehículo para esta visita</h2>
        {invitation.vehicle ? <dl className="detail-fields"><div><dt>Placas</dt><dd>{invitation.vehicle.plates}</dd></div><div><dt>Marca y modelo</dt><dd>{[invitation.vehicle.brand, invitation.vehicle.model].filter(Boolean).join(' ') || 'No registrados'}</dd></div><div><dt>Color</dt><dd>{invitation.vehicle.color || 'No registrado'}</dd></div></dl> : <p className="muted">Sin vehículo</p>}
      </section>
      <p className="form-help">Los datos del contacto se conservan en esta invitación. Si se creó sin vehículo, el visitante puede añadirlo una sola vez antes de su entrada. Para otras correcciones, cancela la invitación activa y crea una nueva.</p>
      <section className="invitation-qr-section" aria-label="Código y enlace del visitante">
        <h2>Código de acceso QR</h2>
        <InvitationQr token={invitation.token} visitorName={invitation.visitorName} status={invitation.status} />
        <Link className="secondary-button" to={invitationPath(invitation.token)}>Abrir vista del visitante</Link>
        <p className="visitor-help">{sharedMode ? 'El enlace no requiere sesión y consulta el estado compartido de la invitación.' : 'Modo local: el enlace solo consulta datos de este navegador y origen.'}</p>
      </section>
      {data.context.canManage && invitation.status === 'activa' && <CancelInvitation key={invitation.id} id={invitation.id} visitorName={invitation.visitorName} />}
      {invitation.status === 'cancelada' && <p role="status" className="agenda-notice">Invitación cancelada. Sus datos permanecen en el historial.</p>}
      {data.context.canManage && <Link className="secondary-button" to="/residente/invitaciones/nueva">Invitar a otro visitante</Link>}
    </>}
  </section>
}

