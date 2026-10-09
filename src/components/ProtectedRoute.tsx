import { Skeleton } from './Skeleton'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../types/auth'
import { getRoleHome } from '../utils/auth'

export function ProtectedRoute({ role }: { role: UserRole }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="session-skeleton"><Skeleton variant="dashboard" label="Recuperando sesión…" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={getRoleHome(user.role)} replace state={{ accessDenied: true }} />
  return <Outlet />
}
