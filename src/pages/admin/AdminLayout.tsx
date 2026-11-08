import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell, BarChart3, CalendarDays, ClipboardList, LayoutDashboard, ListTree, LogOut, Menu, Search, Settings as SettingsIcon, Upload, Users, X, Rows3, CheckCircle2, AlertTriangle, Info, Network,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn, timeAgo } from '@/lib/utils'
import { Logo, Popover } from '@/components/ui/misc'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Modal'
import { EventSelector } from '@/components/admin/EventSelector'
import { CommandPalette } from '@/components/admin/CommandPalette'
import { PublishButton } from '@/components/admin/PublishFlow'

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/events', label: 'Events', icon: CalendarDays },
  { to: '/admin/rosters', label: 'Rosters', icon: Rows3 },
  { to: '/admin/members', label: 'Members', icon: Users },
  { to: '/admin/assignments', label: 'Assignments', icon: ClipboardList },
  { to: '/admin/positions', label: 'Positions', icon: ListTree },
  { to: '/admin/team', label: 'Team', icon: Network },
  { to: '/admin/import', label: 'Imports', icon: Upload },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const admin = useStore((s) => s.admin)
  const logout = useStore((s) => s.logout)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [confirm, setConfirm] = useState(false)
  const isActive = (to: string, end?: boolean) => (end ? pathname === to : pathname.startsWith(to))
  return (
    <div className="flex h-full flex-col px-3 py-5">
      <div className="px-2.5 pb-7"><Logo /></div>
      <nav aria-label="Admin" className="flex-1 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon, end }) => {
          const active = isActive(to, end)
          return (
            <NavLink key={to} to={to} end={end} onClick={onNavigate} className={cn('relative flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium transition-colors', active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900')}>
              {active && <motion.span layoutId="nav-indicator" className="absolute inset-0 rounded-[10px] bg-white shadow-soft ring-1 ring-line" transition={{ type: 'spring', bounce: 0, duration: 0.35 }} />}
              {active && <motion.span layoutId="nav-bar" className="absolute -left-3 top-2.5 h-5 w-[3px] rounded-r bg-wine-500" transition={{ type: 'spring', bounce: 0, duration: 0.35 }} />}
              <Icon className={cn('relative h-[18px] w-[18px]', active ? 'text-wine-600' : '')} strokeWidth={1.8} />
              <span className="relative">{label}</span>
            </NavLink>
          )
        })}
      </nav>
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-white/60 p-2.5">
        <Avatar first={admin?.name ?? 'A'} last="" size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink-900">{admin?.name}</div>
          <div className="truncate text-xs text-ink-500">{admin?.email}</div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => setConfirm(true)} aria-label="Log out"><LogOut className="h-4 w-4" /></Button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} tone="primary" title="Log out?" description="You’ll need to sign in again to manage rosters." confirmLabel="Log out" onConfirm={() => { logout(); navigate('/admin/login') }} />
    </div>
  )
}

function Notifications() {
  const items = useStore((s) => s.notifications)
  const markRead = useStore((s) => s.markNotificationsRead)
  const unread = items.filter((n) => !n.read).length
  const icon = { success: <CheckCircle2 className="h-4 w-4 text-ok-500" />, warn: <AlertTriangle className="h-4 w-4 text-warn-500" />, info: <Info className="h-4 w-4 text-[#4A74AE]" /> }
  return (
    <Popover
      className="w-[min(92vw,380px)]"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} className="relative flex h-9 w-9 items-center justify-center rounded-[10px] text-ink-600 hover:bg-ink-900/[.04]">
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
          {unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-wine-500 ring-2 ring-paper" />}
        </button>
      )}
    >
      {() => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold text-ink-900">Notifications</span>
            {unread > 0 && <button onClick={markRead} className="text-xs font-medium text-wine-600 hover:text-wine-700">Mark all read</button>}
          </div>
          <ul className="scrollbar-thin max-h-96 overflow-y-auto">
            {items.slice(0, 12).map((n) => (
              <li key={n.id} className={cn('flex gap-3 border-b border-line/60 px-4 py-3 last:border-0', !n.read && 'bg-wine-50/30')}>
                <span className="mt-0.5">{icon[n.tone]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium text-ink-900">{n.title}</span>
                    <span className="shrink-0 text-[11px] text-ink-400">{timeAgo(n.at)}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{n.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Popover>
  )
}

export default function AdminLayout() {
  const [cmd, setCmd] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd((o) => !o) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  useEffect(() => setMobileNav(false), [pathname])
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  return (
    <div className="min-h-[100dvh] bg-canvas lg:flex">
      <aside className="sticky top-0 hidden h-[100dvh] w-[252px] shrink-0 lg:block"><SidebarContent /></aside>

      <AnimatePresence>
        {mobileNav && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div className="absolute inset-0 bg-ink-950/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileNav(false)} />
            <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'tween', duration: 0.25 }} className="absolute inset-y-0 left-0 w-[280px] bg-canvas shadow-float">
              <button onClick={() => setMobileNav(false)} className="absolute right-3 top-5 rounded-lg p-2 text-ink-500" aria-label="Close menu"><X className="h-5 w-5" /></button>
              <SidebarContent onNavigate={() => setMobileNav(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="min-w-0 flex-1 lg:py-3 lg:pr-3">
        <div className="min-h-[100dvh] bg-paper lg:min-h-[calc(100dvh-1.5rem)] lg:rounded-shell lg:ring-1 lg:ring-line">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line/80 bg-paper/85 px-4 backdrop-blur-lg lg:rounded-t-shell lg:px-8">
            <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
            <EventSelector />
            <button onClick={() => setCmd(true)} className="ml-1 hidden h-9 min-w-[260px] items-center gap-2 rounded-[10px] bg-ink-900/[.04] px-3 text-sm text-ink-400 transition-colors hover:bg-ink-900/[.06] md:flex">
              <Search className="h-4 w-4" />
              Search members, phones, aisles…
              <span className="ml-auto flex gap-0.5"><span className="kbd">{isMac ? '⌘' : 'Ctrl'}</span><span className="kbd">K</span></span>
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setCmd(true)} aria-label="Search"><Search className="h-[18px] w-[18px]" /></Button>
              <Notifications />
              <PublishButton />
            </div>
          </header>
          <motion.main key={pathname.split('/').slice(0, 3).join('/')} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }} className="px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
            <Outlet />
          </motion.main>
        </div>
      </div>
      <CommandPalette open={cmd} onClose={() => setCmd(false)} />
    </div>
  )
}
