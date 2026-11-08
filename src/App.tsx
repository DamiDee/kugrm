import { useEffect } from 'react'
import { HashRouter, MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { Toaster } from '@/components/ui/Toast'
import Lookup from '@/pages/public/Lookup'
import AssignmentResult from '@/pages/public/AssignmentResult'
import Help from '@/pages/public/Help'
import AdminLogin from '@/pages/admin/Login'
import AdminLayout from '@/pages/admin/AdminLayout'
import Overview from '@/pages/admin/Overview'
import Events from '@/pages/admin/Events'
import EventDetail from '@/pages/admin/EventDetail'
import Members from '@/pages/admin/Members'
import Assignments from '@/pages/admin/Assignments'
import Positions from '@/pages/admin/Positions'
import Rosters from '@/pages/admin/Rosters'
import Reports from '@/pages/admin/Reports'
import Settings from '@/pages/admin/Settings'
import Import from '@/pages/admin/Import'
import Team from '@/pages/admin/Team'
import TeamLogin from '@/pages/team/TeamLogin'
import TeamHome from '@/pages/team/TeamHome'
import { useStore } from '@/store/useStore'


function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const admin = useStore((s) => s.admin)
  const loc = useLocation()
  if (!admin) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />
  return <>{children}</>
}

// Hash URLs need a real page address. Inside sandboxed previews (about:srcdoc, blob:) fall back to in-memory routing.
const canUseHash = (() => {
  try { new URL('/', window.location.href); return /^(https?|file):$/.test(window.location.protocol) } catch { return false }
})()
const Router = canUseHash ? HashRouter : MemoryRouter

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollTop />
        <Routes>
          <Route path="/" element={<Lookup />} />
          <Route path="/assignment" element={<AssignmentResult />} />
          <Route path="/help" element={<Help />} />
          <Route path="/team/login" element={<TeamLogin />} />
          <Route path="/team" element={<TeamHome />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<Overview />} />
            <Route path="events" element={<Events />} />
            <Route path="events/:id" element={<EventDetail />} />
            <Route path="rosters" element={<Rosters />} />
            <Route path="members" element={<Members />} />
            <Route path="members/:id" element={<Members />} />
            <Route path="assignments" element={<Assignments />} />
            <Route path="positions" element={<Positions />} />
            <Route path="team" element={<Team />} />
            <Route path="import" element={<Import />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </Router>
    </MotionConfig>
  )
}
