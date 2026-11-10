import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { CampaignDetailPage } from './pages/CampaignDetail'
import { CampaignFormPage } from './pages/CampaignFormPage'
import { DailyEntryPage } from './pages/DailyEntry'
import { LoginPage } from './pages/Login'
import { OverviewPage } from './pages/Overview'
import { TraditionalDetailPage } from './pages/TraditionalDetail'
import { TraditionalFormPage } from './pages/TraditionalForm'
import { TraditionalListPage } from './pages/TraditionalList'
import { UpcomingPage } from './pages/Upcoming'
import { WeeklyReportPage } from './pages/WeeklyReport'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route index element={<OverviewPage />} />
                <Route path="upcoming" element={<UpcomingPage />} />
                <Route path="traditional" element={<TraditionalListPage />} />
                <Route path="campaigns/:id/reports/:weekStart" element={<WeeklyReportPage />} />

                <Route element={<ProtectedRoute adminOnly />}>
                  <Route path="campaigns/new" element={<CampaignFormPage />} />
                  <Route path="campaigns/:id/edit" element={<CampaignFormPage />} />
                  <Route path="traditional/new" element={<TraditionalFormPage />} />
                  <Route path="traditional/:id/edit" element={<TraditionalFormPage />} />
                  <Route path="daily-entry" element={<DailyEntryPage />} />
                </Route>

                <Route path="traditional/:id" element={<TraditionalDetailPage />} />
                <Route path="campaigns/:id" element={<CampaignDetailPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
