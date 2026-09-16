import { useEffect, useState } from 'react'
import { communityService } from '../services/communityService'

export function useCommunityQuery<T>(fetchData: () => Promise<T>, refreshMs = 0) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    let request = 0
    setData(null)
    setLoading(true)
    const refresh = async () => {
      const current = ++request
      try {
        const result = await fetchData()
        if (active && current === request) { setData(result); setError('') }
      } catch (error) {
        if (active && current === request) { setData(null); setError(error instanceof Error ? error.message : 'No se pudieron cargar los datos.') }
      } finally {
        if (active && current === request) setLoading(false)
      }
    }
    const unsubscribe = communityService.subscribe(() => { void refresh() })
    const timer = refreshMs > 0 ? window.setInterval(() => { void refresh() }, refreshMs) : undefined
    void refresh()
    return () => { active = false; unsubscribe(); window.clearInterval(timer) }
  }, [fetchData, refreshMs])

  return { data, error, loading }
}
