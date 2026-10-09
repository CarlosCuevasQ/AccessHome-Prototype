import { Skeleton } from '../components/Skeleton'
import { sharedMode } from '../services/shared/provider'
import { useCallback } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { ActionLink } from '../components/ActionLink'
import { Icon } from '../components/Icon'
import { Disclosure } from '../components/Disclosure'
import { FadeContent } from '../components/react-bits/FadeContent'
import { invitationsService } from '../services/invitationsService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { formatDate } from '../utils/dates'
import { InvitationStatusLabel } from '../components/invitations/InvitationStatusLabel'
import { CancelInvitation } from '../components/invitations/CancelInvitation'
import { InvitationQr } from '../components/invitations/InvitationQr'
import { InvitationShare } from '../components/invitations/InvitationShare'
import { invitationPath } from '../utils/invitationLinks'

export function InvitationPage() {
  const { invitationId = '' } = useParams()
  const location = useLocation()
  const load = useCallback(async () => ({ context: await invitationsService.getContext(), invitation: await invitationsService.getInvitation(invitationId) }), [invitationId])
  const { data, loading, error } = useCommunityQuery(load, 1000)
  const invitation = data?.invitation
  usePageTitle(invitation ? `Invitación · ${invitation.visitorName}` : 'Invitación')
  return <section className="community-page invitations-page resident-experience resident-invitation-detail">
    <ActionLink variant="back" to="/residente/invitaciones">Volver a invitaciones</ActionLink>
    {loading && <Skeleton variant="invitation-detail" label="Cargando invitación…" />}
    {error && <><h1>Invitación no disponible</h1><p className="form-error" role="alert">{error}</p></>}
    {invitation && <>
      {location.state?.created === true && <p className="form-success" role="status">Invitación creada correctamente para {invitation.residenceName}.</p>}
      <FadeContent className="resident-title"><header><div><h1>{invitation.visitorName}</h1><p className="lead"><Icon name="home" />{invitation.residenceName}</p></div><InvitationStatusLabel status={invitation.status} /></header></FadeContent>
      {invitation.status === 'activa' && Date.parse(invitation.startsAt) > Date.now() && <p className="agenda-notice">Visita programada. Su vigencia comenzará el {formatDate(invitation.startsAt)}</p>}
      <div className="invitation-detail-grid">
      <div className="invitation-share-slot"><InvitationShare key={`share-${invitation.id}`} token={invitation.token} /></div>
      <section className="invitation-facts" aria-labelledby="invitation-summary-title">
        <h2 id="invitation-summary-title"><Icon name="clock" />Vigencia y visita</h2>
        <dl className="detail-fields period-fields"><div><dt>Inicio</dt><dd>{formatDate(invitation.startsAt)}</dd></div><div><dt>Expiración</dt><dd>{formatDate(invitation.expiresAt)}</dd></div></dl>
        <dl className="detail-fields"><div><dt>Residencia destino</dt><dd>{invitation.residenceName}</dd></div><div><dt>Invita</dt><dd>{invitation.inviterName}</dd></div>
          <div><dt>Usos utilizados</dt><dd>{invitation.usedUses} de {invitation.maxUses}</dd></div>{invitation.phone && <div><dt>Teléfono</dt><dd>{invitation.phone}</dd></div>}
        </dl>
        {invitation.vehicle && <section className="visit-vehicle" aria-label="Vehículo para esta visita"><div className="entity-symbol"><Icon name="car" /></div><div><h3>Vehículo de la visita</h3><strong className="license-plate">{invitation.vehicle.plates}</strong><p>{[invitation.vehicle.brand, invitation.vehicle.model].filter(Boolean).join(' ') || 'Marca y modelo no registrados'}{invitation.vehicle.color && ` · ${invitation.vehicle.color}`}</p></div></section>}
        <Disclosure title="Información de la invitación"><p>Creada el {formatDate(invitation.createdAt)}.</p><p>Los datos del contacto se conservan en esta invitación. Para corregirlos, cancela la invitación activa y crea una nueva.</p></Disclosure>
      </section>
      <section className="invitation-qr-section resident-pass" aria-label="Código y enlace del visitante">
        <div className="pass-heading"><Icon name="scan" /><h2>Código de acceso</h2></div>
        <p className="pass-subtitle">{invitation.visitorName}</p>
        <InvitationQr token={invitation.token} visitorName={invitation.visitorName} status={invitation.status} />
        <p className="pass-validity">Hasta {formatDate(invitation.expiresAt)}</p>
        <ActionLink variant="detail" to={invitationPath(invitation.token)}>Abrir vista del visitante</ActionLink>
        <p className="visitor-help">{sharedMode ? 'El enlace no requiere sesión y consulta el estado compartido de la invitación.' : 'Modo local: el enlace solo consulta datos de este navegador y origen.'}</p>
      </section>
      </div>
      {invitation.status === 'cancelada' && <p role="status" className="agenda-notice">Invitación cancelada. Sus datos permanecen en el historial.</p>}
      {data.context.canManage && <footer className="invitation-secondary-actions"><ActionLink icon="plus" to="/residente/invitaciones/nueva">Invitar a otro visitante</ActionLink>
        {invitation.status === 'activa' && <CancelInvitation key={invitation.id} id={invitation.id} visitorName={invitation.visitorName} />}
      </footer>}
    </>}
  </section>
}

