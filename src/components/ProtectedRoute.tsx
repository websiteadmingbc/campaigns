import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingState } from './ui'

export function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { session, loading, isAdmin, configMissing } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState label="Checking session…" />
      </div>
    )
  }

  if (configMissing) {
    return <Navigate to="/login" replace />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
