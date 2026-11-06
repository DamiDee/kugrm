import { Link, NavLink } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Logo } from '@/components/ui/misc'
import { cn } from '@/lib/utils'

/** Faint architectural line drawing used as texture behind the hero. */
export function FloorplanTexture({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 800" className={cn('pointer-events-none absolute inset-0 h-full w-full', className)} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M640 120H1140V700H640Z" />
        <path d="M640 230H1140M640 610H1140M760 120V230M1020 120V230" />
        {Array.from({ length: 9 }).map((_, i) => (
          <path key={i} d={`M${700 + i * 50} 260V580`} strokeDasharray="2 10" />
        ))}
        <path d="M840 700A36 36 0 0 1 876 664M940 700A36 36 0 0 0 904 664" />
        <path d="M1140 360H1200V520H1140" />
        <circle cx="1080" cy="760" r="22" />
        <circle cx="700" cy="760" r="14" />
      </g>
    </svg>
  )
}

export function PublicNav({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const link = ({ isActive }: { isActive: boolean }) =>
    cn('rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors', isActive ? 'bg-ink-900 text-white' : 'text-ink-600 hover:text-ink-900')
  return (
    <header className="relative z-10 flex items-start justify-between px-5 pt-5 md:px-8">
      <Link to="/" aria-label="Global Roster Manager home" className="pt-1">
        <Logo light={tone === 'dark'} />
      </Link>
      {/* notched tab cut into the shell, as in the reference designs */}
      <nav aria-label="Main" className="notch absolute left-1/2 top-0 hidden -translate-x-1/2 rounded-b-[24px] bg-canvas px-2 pb-2 pt-2 md:block" style={{ ['--notch' as string]: '#F3F0EA' }}>
        <div className="flex items-center gap-1">
          <NavLink to="/" end className={link}>Find Assignment</NavLink>
          <NavLink to="/help" className={link}>Help</NavLink>
        </div>
      </nav>
      <Link
        to="/admin/login"
        className={cn(
          'group inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition-colors',
          tone === 'dark' ? 'bg-white/10 text-white ring-1 ring-white/15 backdrop-blur hover:bg-white/15' : 'bg-white text-ink-800 ring-1 ring-line hover:ring-line-strong',
        )}
      >
        Admin Login
        <ArrowUpRight className={cn('h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5', tone === 'dark' ? 'text-gold-300' : 'text-wine-500')} />
      </Link>
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-ink-500 sm:flex-row">
      <span>Koinonia Global · Ushering Department</span>
      <span className="flex gap-4">
        <Link to="/help" className="hover:text-ink-800">Help</Link>
        <Link to="/admin/login" className="hover:text-ink-800">Administrators</Link>
      </span>
    </footer>
  )
}
