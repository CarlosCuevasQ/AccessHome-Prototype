import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'

const stages = {
  scan: { title: 'Escanear acceso', description: 'La lectura de QR y la validación de entradas y salidas para guardias se habilitarán en una próxima etapa. Por ahora puedes consultar la actividad registrada en caseta.' },
  services: { title: 'Registrar servicio', description: 'El registro y seguimiento de proveedores y servicios se habilitará en una próxima etapa. Actualmente no se registran servicios desde este panel.' },
  reports: { title: 'Reportes de turno', description: 'Los reportes del personal de seguridad se habilitarán en una próxima etapa. Los reportes privados de residentes no forman parte de esta sección.' },
}
export function GuardUpcomingPage({ stage }: { stage: keyof typeof stages }) {
  const item = stages[stage]
  usePageTitle(item.title)
  return <section className="community-page guard-page">
    <p className="eyebrow">Guardia / Caseta</p><h1>{item.title}</h1>
    <p className="status-badge">Próxima etapa</p><p className="lead">{item.description}</p>
    <div className="dashboard-actions"><Link className="button-link" to="/guardia">Volver a caseta</Link><Link className="secondary-button" to="/guardia/historial">Consultar historial</Link></div>
  </section>
}
