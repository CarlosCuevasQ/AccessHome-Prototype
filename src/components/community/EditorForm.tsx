import { useEffect, useRef, useState } from 'react'
import type { ReactNode, FormEvent } from 'react'

interface EditorFormProps {
  title: string
  children: ReactNode
  save: () => Promise<unknown>
  onSaved: () => void
  onCancel: () => void
  submitLabel?: string
}

export function EditorForm({ title, children, save, onSaved, onCancel, submitLabel = 'Guardar' }: EditorFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => { formRef.current?.querySelector('input')?.focus() }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try { await save(); onSaved() } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.')
    } finally { setSaving(false) }
  }

  return (
    <form ref={formRef} className="editor-form" onSubmit={(event) => { void submit(event) }} aria-label={title} aria-busy={saving}>
      <h3>{title}</h3>
      <fieldset disabled={saving}>
        <legend className="sr-only">{title}</legend>
        <div className="form-grid">{children}</div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button className="button-link" type="submit">{saving ? 'Guardando…' : submitLabel}</button>
          <button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </fieldset>
    </form>
  )
}
