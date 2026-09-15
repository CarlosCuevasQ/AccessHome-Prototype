import { Link } from 'react-router-dom'

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="AccessHome, ir al inicio">
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M5 14 16 5l11 9v13H5V14Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M12 27V16h8v11M16 21h1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      <span>Access<span className="brand-light">Home</span></span>
    </Link>
  )
}
