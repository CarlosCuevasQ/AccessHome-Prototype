import { Link } from 'react-router-dom'
import { workspaces } from '../data/navigation'
import { usePageTitle } from '../hooks/usePageTitle'
import type { WorkspaceRole } from '../types/navigation'

export function WorkspacePage({ role }: { role: WorkspaceRole }) {
  const workspace = workspaces[role]
  usePageTitle(workspace.label)

  return (
    <section className="workspace-page">
      <p className="eyebrow">{workspace.label} / Inicio</p>
      <h1>{workspace.title}</h1>
      <p className="lead">{workspace.description}</p>
      <div className="stage-banner">
        <span className="status-badge">Etapa 1</span>
        <p>Navegación inicial disponible</p>
      </div>
      <section className="scope-section" aria-labelledby="scope-title">
        <h2 id="scope-title">Qué puedes explorar</h2>
        <dl className="feature-list">
          <div><dt>Tu espacio</dt><dd>Un espacio propio para el perfil de {workspace.label.toLowerCase()}.</dd></div>
          <div><dt>Vista adaptable</dt><dd>Menú lateral en escritorio y menú desplegable en teléfono.</dd></div>
          <div><dt>Cambio de perfil</dt><dd>Vuelve al acceso temporal para conocer el otro espacio.</dd></div>
        </dl>
      </section>
      <p className="muted">Los módulos de gestión y los datos de la comunidad estarán disponibles en etapas posteriores.</p>
      <Link className="button-link" to="/login">Volver al acceso temporal</Link>
    </section>
  )
}
