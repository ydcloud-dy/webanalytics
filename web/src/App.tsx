import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import SitesPage from './pages/SitesPage'
import DashboardLayout from './components/DashboardLayout'
import OverviewPage from './pages/OverviewPage'
import RealtimePage from './pages/RealtimePage'
import GeoPage from './pages/GeoPage'
import DeviceSoftwarePage from './pages/DeviceSoftwarePage'
import PagesPage from './pages/PagesPage'
import VisitTimePage from './pages/VisitTimePage'
import PerformancePage from './pages/PerformancePage'
import LoyaltyPage from './pages/LoyaltyPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminSiteMembersPage from './pages/AdminSiteMembersPage'
import ErrorsPage from './pages/ErrorsPage'
import SystemMonitorPage from './pages/SystemMonitorPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/sites"
          element={
            <PrivateRoute>
              <SitesPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard/:siteId"
          element={
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="realtime" element={<RealtimePage />} />
          <Route path="geo" element={<GeoPage />} />
          <Route path="devices" element={<DeviceSoftwarePage />} />
          <Route path="visit-time" element={<VisitTimePage />} />
          <Route path="pages" element={<PagesPage />} />
          <Route path="performance" element={<PerformancePage />} />
          <Route path="loyalty" element={<LoyaltyPage />} />
          <Route path="errors" element={<ErrorsPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/members" element={<AdminSiteMembersPage />} />
          <Route path="admin/system" element={<SystemMonitorPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/sites" replace />} />
      </Routes>
    </AuthProvider>
  )
}
