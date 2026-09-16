import type { InvitationValidity } from '../../types/invitations'

interface ValidityFieldsProps {
  kind: InvitationValidity['kind']
  onKindChange: (kind: InvitationValidity['kind']) => void
  startsAt: string
  expiresAt: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
}

export function ValidityFields({ kind, onKindChange, startsAt, expiresAt, onStartChange, onEndChange }: ValidityFieldsProps) {
  return <fieldset className="invitation-fieldset">
    <legend>Vigencia</legend>
    <div className="validity-options">
      {([{ value: 'today', label: 'Hoy' }, { value: '24hours', label: '24 horas' }, { value: 'custom', label: 'Personalizada' }] as const).map((option) => <label className="choice-label" key={option.value}>
        <input type="radio" name="validity" value={option.value} checked={kind === option.value} onChange={() => onKindChange(option.value)} />{option.label}
      </label>)}
    </div>
    {kind === 'custom' ? <div className="custom-validity">
      <label className="form-field">Fecha y hora de inicio<input type="datetime-local" required value={startsAt} onInput={(event) => onStartChange(event.currentTarget.value)} /></label>
      <label className="form-field">Fecha y hora final<input type="datetime-local" required min={startsAt} value={expiresAt} onInput={(event) => onEndChange(event.currentTarget.value)} /></label>
      <p className="form-help">Las fechas se muestran en la hora local de tu dispositivo.</p>
    </div> : <p className="form-help">{kind === 'today' ? 'Desde ahora hasta terminar el día de hoy, en tu hora local.' : 'Durante 24 horas a partir de la generación.'}</p>}
  </fieldset>
}
