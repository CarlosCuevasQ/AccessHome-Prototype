import { useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { publicInvitationService } from '../services/publicInvitationService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { formatDate } from '../utils/dates'
import { InvitationQr } from '../components/invitations/InvitationQr'
import { InvitationStatusLabel } from '../components/invitations/InvitationStatusLabel'
import { VisitorVehicleForm } from '../components/invitations/VisitorVehicleForm'
import { sharedMode } from '../services/shared/provider'

export function PublicInvitationPage() {
  const { token = '' } = useParams()
  const load = useCallback(() => publicInvitationService.getInvitation(token), [token])
  const { data, error, loading } = useCommunityQuery(load, 1000)
  const [savedToken, setSavedToken] = useState('')
  usePageTitle(data ? `Visita de ${data.visitorName}` : 'Invitación de visita')

  return <section className="community-page invitations-page visitor-page">
    <p className="eyebrow">Invitación de visita</p>
    {loading && <p role="status">Cargando invitación…</p>}
    {error && <><h1>Invitación no disponible</h1><p className="form-error" role="alert">{error}</p><p className="visitor-help">Comprueba tu conexión y solicita el enlace correcto a tu anfitrión.</p></>}
    {data && <>
      <h1>{data.visitorName}</h1>
      <p className="visitor-destination">{data.residenceName} <span>Anfitrión: {data.inviterName}</span></p>
      <InvitationStatusLabel status={data.status} />
      <InvitationQr token={data.token} visitorName={data.visitorName} status={data.status} />
      {data.status !== 'activa' && <p className="access-notice">Esta invitación ya no permite accesos.</p>}
      {data.status === 'activa' && data.usedUses === 1 && <p className="access-notice">Entrada registrada. Conserva este QR para tu salida.</p>}
      {data.status === 'activa' && Date.parse(data.startsAt) > Date.now() && <p className="access-notice">La invitación todavía no inicia. Revisa la vigencia antes de llegar.</p>}
      <section className="visitor-details" aria-label="Datos de tu visita">
        <h2>Tu visita</h2>
        <dl className="detail-fields">
          <div><dt>Válida desde</dt><dd>{formatDate(data.startsAt)}</dd></div>
          <div><dt>Válida hasta</dt><dd>{formatDate(data.expiresAt)}</dd></div>
          <div><dt>Vehículo</dt><dd>{data.vehicle ? [data.vehicle.brand, data.vehicle.model].filter(Boolean).join(' ') || 'Vehículo registrado' : 'Sin vehículo'}</dd></div>
          <div><dt>Placas</dt><dd>{data.vehicle?.plates ?? 'No aplica'}</dd></div>
          {data.vehicle?.color && <div><dt>Color</dt><dd>{data.vehicle.color}</dd></div>}
          <div><dt>Usos utilizados</dt><dd>{data.usedUses} de {data.maxUses}</dd></div>
        </dl>
        <p className="form-help">Horarios en la hora local de este dispositivo.</p>
      </section>
      {savedToken === token && <p className="form-success" role="status">Vehículo guardado para esta invitación.</p>}
      {data.canAddVehicle && <VisitorVehicleForm key={token} token={token} onSaved={() => setSavedToken(token)} />}
      <p className="visitor-help">{sharedMode ? 'Invitación compartida. El estado se actualiza al consultar y periódicamente mientras esta pantalla está visible.' : 'Modo local: este enlace utiliza únicamente los datos de este navegador.'}</p>
    </>}
  </section>
}
