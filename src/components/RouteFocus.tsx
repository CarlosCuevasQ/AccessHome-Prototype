import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function RouteFocus() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [pathname])

  return null
}
