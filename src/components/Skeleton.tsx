export function Skeleton({ variant = 'list', label = 'Cargando contenido…' }: { variant?: 'list' | 'dashboard' | 'detail' | 'form' | 'qr' | 'invitation-detail' | 'residence' | 'report'; label?: string }) {
  if (['invitation-detail', 'residence', 'report'].includes(variant)) return <div className={`skeleton skeleton-${variant} skeleton-composed`} role="status" aria-label={label}>
    <span className="sr-only">{label}</span><div aria-hidden="true">
      <span className="skeleton-line skeleton-title" /><span className="skeleton-line skeleton-short" />
      <div className="skeleton-composition"><div>{[0, 1, 2].map(i => <div className="skeleton-row" key={i}><span className="skeleton-line" /><span className="skeleton-line skeleton-short" /></div>)}</div>
        <div className="skeleton-side">{variant === 'invitation-detail' ? <span className="skeleton-qr" /> : <span className="skeleton-block" />}<span className="skeleton-line" /></div>
      </div>
    </div>
  </div>
  return <div className={`skeleton skeleton-${variant}`} role="status" aria-label={label}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true">
      <span className="skeleton-line skeleton-title" />
      {variant === 'dashboard' ? <div className="skeleton-metrics">{[0, 1, 2, 3].map(i => <span className="skeleton-block" key={i} />)}</div>
        : variant === 'qr' ? <span className="skeleton-qr" /> : null}
      {[0, 1, 2].map(i => <div className="skeleton-row" key={i}><span className="skeleton-line" /><span className="skeleton-line skeleton-short" /></div>)}
    </div>
  </div>
}
