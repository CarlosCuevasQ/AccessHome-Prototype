import { useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { publicInvitationService } from '../services/publicInvitationService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { formatDate } from '../utils/dates'
import { InvitationQr } from '../components/invitations/InvitationQr'
import { InvitationStatusLabel } from '../components/invitations/InvitationStatusLabel'
import { sharedMode } from '../services/shared/provider'

export function PublicInvitationPage() {
  const { token = '' } = useParams()
  const [revision, setRevision] = useState(0)
  const load = useCallback(() => publicInvitationService.getInvitation(token), [token, revision])
  const { data, error, loading } = useCommunityQuery(load, 1000)
  usePageTitle('Invitación de visita')

  return <section className="community-page invitations-page visitor-page">
    <p className="eyebrow">Invitación de visita</p>
    {loading && <p role="status">Cargando invitación…</p>}
    {error && <><h1>Invitación no disponible</h1><p className="form-error" role="alert">{error}</p><p className="visitor-help">Comprueba tu conexión y solicita el enlace correcto a tu anfitrión.</p></>}
    {data && <>
      <h1>{data.visitorName}</h1>
      <p className="visitor-destination">{data.residenceName} <span>{data.condominiumName}</span></p>
      <InvitationStatusLabel status={data.status} />
      <InvitationQr token={data.token} visitorName={data.visitorName} status={data.status} />
      <section className="visitor-details" aria-label="Vigencia de tu visita">
        <h2>Vigencia</h2>
        <dl className="detail-fields">
          <div><dt>Válida desde</dt><dd>{formatDate(data.startsAt)}</dd></div>
          <div><dt>Válida hasta</dt><dd>{formatDate(data.expiresAt)}</dd></div>
        </dl>
        <p className="form-help">Horarios en la hora local de este dispositivo.{data.status === 'activa' && ' Presenta el QR dentro de este periodo y consérvalo hasta tu salida.'}</p>
      </section>
    </>}
    <button type="button" className="secondary-button" disabled={loading} onClick={() => setRevision(value => value + 1)}>Actualizar estado</button>
    <p className="visitor-help">{sharedMode ? 'El estado se consulta en línea al abrir, al recuperar la conexión y cada 10 segundos mientras esta página está visible. El QR no sustituye la validación en caseta.' : 'Modo local: este enlace utiliza únicamente los datos de este navegador y no funciona en otro dispositivo.'}</p>
  </section>
}
