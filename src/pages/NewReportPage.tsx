import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { reportCategories } from '../types/reports'
import type { ReportCategory } from '../types/reports'
import { reportsService } from '../services/reportsService'
import { useCommunityQuery } from '../hooks/useCommunityQuery'
import { usePageTitle } from '../hooks/usePageTitle'

export function NewReportPage() {
  usePageTitle('Crear reporte')
  const navigate = useNavigate()
  const { data, error, loading } = useCommunityQuery(reportsService.getContext)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ReportCategory>('Seguridad')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true); setSaveError('')
    try {
      const id = await reportsService.createReport({ title, category, description })
      navigate(`/residente/reportes/${id}`, { state: { created: true } })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo enviar el reporte.')
    } finally { setSaving(false) }
  }
  return <section className="community-page reports-page">
    <Link className="back-link" to="/residente/reportes">Volver a mis reportes</Link><h1>Crear reporte</h1>
    <p className="lead">Envía una solicitud a la administración desde {data?.residenceName ?? 'tu residencia'}.</p>
    {loading && <p role="status">Cargando…</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {data && (data.canCreate ? <form className="editor-form" onSubmit={(event) => { void submit(event) }} aria-label="Crear reporte" aria-busy={saving}>
      <fieldset disabled={saving}><legend className="sr-only">Datos del reporte</legend><div className="form-grid">
        <label className="form-field">Título<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="form-field">Categoría<select value={category} onChange={(event) => setCategory(event.target.value as ReportCategory)}>{reportCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="form-field">Descripción<textarea required maxLength={3000} rows={6} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      </div>{saveError && <p role="alert" className="form-error">{saveError}</p>}<div className="form-actions"><button className="button-link" type="submit">{saving ? 'Enviando…' : 'Enviar reporte'}</button><Link className="secondary-button" to="/residente/reportes">Cancelar</Link></div></fieldset>
    </form> : <p className="access-notice">Solo el principal de una residencia activa puede crear reportes.</p>)}
  </section>
}
