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
import { InvitationsPage } from './pages/InvitationsPage'
import { InvitationPage } from './pages/InvitationPage'
import { NewInvitationPage } from './pages/NewInvitationPage'
import { PublicInvitationPage } from './pages/PublicInvitationPage'
import { AccessControlPage } from './pages/AccessControlPage'
import { AccessHistoryPage } from './pages/AccessHistoryPage'
import { ReportsPage } from './pages/ReportsPage'
import { ReportPage } from './pages/ReportPage'
import { NewReportPage } from './pages/NewReportPage'
import { ResidentDashboardPage } from './pages/ResidentDashboardPage'

export const router = createBrowserRouter([
  {
    element: <PublicLayout visitor />,
    children: [{ path: '/invitacion/:token', element: <PublicInvitationPage /> }],
  },
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
          { path: 'control-acceso', element: <AccessControlPage /> },
          { path: 'historial', element: <AccessHistoryPage /> },
          { path: 'reportes', element: <ReportsPage /> },
          { path: 'reportes/:reportId', element: <ReportPage /> },
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
          { index: true, element: <ResidentDashboardPage /> },
          { path: 'mi-residencia', element: <ResidencePage /> },
          { path: 'historial', element: <AccessHistoryPage /> },
          { path: 'reportes', element: <ReportsPage /> },
          { path: 'reportes/nuevo', element: <NewReportPage /> },
          { path: 'reportes/:reportId', element: <ReportPage /> },
          { element: <PrincipalRoute />, children: [
            { path: 'contactos', element: <ContactsPage /> },
            { path: 'contactos/:contactId', element: <ContactPage /> },
            { path: 'contactos/:contactId/invitar', element: <NewInvitationPage /> },
          ] },
          { path: 'invitaciones', element: <InvitationsPage /> },
          { path: 'invitaciones/nueva', element: <NewInvitationPage /> },
          { path: 'invitaciones/:invitationId', element: <InvitationPage /> },
          { path: 'perfil', element: <WorkspacePage role="resident" /> },
          { path: '*', element: <NotFoundPage homePath="/residente" /> },
        ],
      },
    ],
  },
])
