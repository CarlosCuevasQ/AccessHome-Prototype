import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PublicLayout } from './layouts/PublicLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { ResidentLayout } from './layouts/ResidentLayout'
import { LoginPage } from './pages/LoginPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { CondominiumPage } from './pages/CondominiumPage'
import { ResidencesPage } from './pages/ResidencesPage'
import { ResidencePage } from './pages/ResidencePage'
import { ContactsPage } from './pages/ContactsPage'
import { ContactPage } from './pages/ContactPage'
import { PrincipalRoute } from './components/PrincipalRoute'

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
    element: <ProtectedRoute role="admin" />,
    children: [
      {
        path: '/admin', element: <AdminLayout />,
        children: [
          { index: true, element: <CondominiumPage /> },
          { path: 'residencias', element: <ResidencesPage /> },
          { path: 'residencias/:residenceId', element: <ResidencePage administrative /> },
          { path: 'perfil', element: <WorkspacePage role="admin" /> },
          { path: '*', element: <NotFoundPage homePath="/admin" /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute role="resident" />,
    children: [
      {
        path: '/residente', element: <ResidentLayout />,
        children: [
          { index: true, element: <ResidencePage /> },
          { element: <PrincipalRoute />, children: [
            { path: 'contactos', element: <ContactsPage /> },
            { path: 'contactos/:contactId', element: <ContactPage /> },
            { path: 'contactos/:contactId/invitar', element: <ContactPage invitation /> },
          ] },
          { path: 'perfil', element: <WorkspacePage role="resident" /> },
          { path: '*', element: <NotFoundPage homePath="/residente" /> },
        ],
      },
    ],
  },
])
