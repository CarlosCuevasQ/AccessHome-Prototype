import { useLocation } from 'react-router-dom'

export function AccessNotice() {
  const location = useLocation()
  return location.state?.accessDenied ? <p className="access-notice" role="alert">Tu perfil no tiene acceso a esa sección. Te llevamos a tu inicio.</p> : null
}
