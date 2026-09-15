import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'

export function NotFoundPage({ homePath = '/login' }: { homePath?: string }) {
  usePageTitle('Página no encontrada')

  return (
    <section className="not-found">
      <p className="eyebrow">Error 404</p>
      <h1>Esta página no está disponible</h1>
      <p>Revisa la dirección o vuelve al inicio para continuar navegando.</p>
      <Link className="button-link" to={homePath}>Volver al inicio</Link>
    </section>
  )
}
