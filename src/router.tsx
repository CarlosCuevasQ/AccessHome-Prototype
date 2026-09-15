import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PublicLayout } from './layouts/PublicLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { ResidentLayout } from './layouts/ResidentLayout'
import { LoginPage } from './pages/LoginPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { NotFoundPage } from './pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <Navigate to="/login" replace /> },
      { path: '/login', element: <LoginPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <WorkspacePage role="admin" /> },
      { path: '*', element: <NotFoundPage homePath="/admin" /> },
    ],
  },
  {
    path: '/residente',
    element: <ResidentLayout />,
    children: [
      { index: true, element: <WorkspacePage role="resident" /> },
      { path: '*', element: <NotFoundPage homePath="/residente" /> },
    ],
  },
])
