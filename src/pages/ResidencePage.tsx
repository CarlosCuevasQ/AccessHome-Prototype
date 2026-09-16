import { useCallback } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { communityService } from '../services/communityService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { useAuth } from '../hooks/useAuth'
import { usePageTitle } from '../hooks/usePageTitle'
import { ResidenceContent } from '../components/community/ResidenceContent'
import { AccessNotice } from '../components/AccessNotice'

export function ResidencePage({ administrative = false }: { administrative?: boolean }) {
  const { residenceId } = useParams()
  const [searchParams] = useSearchParams()
  const action = !administrative ? searchParams.get('accion') : null
  const initialAction = action === 'vehiculo' ? 'vehicle' : action === 'habitante' ? 'inhabitant' : undefined
  const { user } = useAuth()
  const id = administrative ? residenceId : user?.residenceId ?? undefined
  const load = useCallback(() => communityService.getResidence(id), [id])
  const { data, error, loading } = useCommunityQuery(load)
  usePageTitle(data?.residence.name ?? 'Residencia')
  return (
    <section className="community-page">
      <p className="eyebrow">{administrative ? 'Administración / Residencias' : 'Residente / Mi residencia'}</p>
      <AccessNotice />
      {administrative && <Link className="back-link" to="/admin/residencias">Volver a residencias</Link>}
      {loading && <p role="status">Cargando residencia…</p>}
      {error && <><h1>Residencia no disponible</h1><p className="form-error" role="alert">{error}</p></>}
      {data && <ResidenceContent key={`${data.residence.id}:${user?.id}:${initialAction}`} data={data} initialAction={initialAction} />}
    </section>
  )
}
