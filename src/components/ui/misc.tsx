import { useEffect, useRef, useState } from 'react'
import { animate, motion, useInView } from 'framer-motion'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Logo({ compact, light, className }: { compact?: boolean; light?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" fill={light ? '#FFFFFF' : '#111827'} />
        <path d="M9 10h14M9 16h9M9 22h14" stroke={light ? '#7C2541' : '#E5CA8E'} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="22.5" cy="16" r="2" fill={light ? '#C59E4F' : '#B65A75'} />
      </svg>
      {!compact && (
        <span className="leading-none">
          <span className={cn('block text-[15px] font-semibold tracking-tight', light ? 'text-white' : 'text-ink-900')}>Global Roster</span>
          <span className={cn('mt-0.5 block text-[10.5px] font-medium uppercase tracking-[0.16em] max-[389px]:hidden', light ? 'text-white/55' : 'text-ink-500')}>Koinonia Ushering</span>
        </span>
      )}
    </span>
  )
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink-900 md:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[14.5px] text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon, title, description, action, className }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="relative mb-5">
        <div className="absolute inset-0 -m-3 rounded-full border border-dashed border-line-strong" />
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-paper text-ink-500 ring-1 ring-line">{icon}</div>
      </div>
      <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function AnimatedNumber({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const prev = useRef(0)
  useEffect(() => {
    if (!inView || !ref.current) return
    const node = ref.current
    const c = animate(prev.current, value, {
      duration: 0.7,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => { node.textContent = v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix },
    })
    prev.current = value
    return () => c.stop()
  }, [value, inView, decimals, suffix])
  return <span ref={ref} className="tabular">{(0).toFixed(decimals)}{suffix}</span>
}

export function MetricCard({ label, value, decimals, suffix, hint, icon, tone }: { label: string; value: number; decimals?: number; suffix?: string; hint?: React.ReactNode; icon?: React.ReactNode; tone?: 'wine' | 'ok' | 'warn' }) {
  return (
    <div className="group relative px-5 py-4">
      <div className="flex items-center gap-2 text-[13px] text-ink-500">
        {icon && <span className={cn('text-ink-400', tone === 'wine' && 'text-wine-500', tone === 'ok' && 'text-ok-500', tone === 'warn' && 'text-warn-500')}>{icon}</span>}
        {label}
      </div>
      <div className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink-900">
        <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
      </div>
      {hint && <div className="mt-2 text-xs text-ink-500">{hint}</div>}
    </div>
  )
}

export function ProgressBar({ value, tone = 'wine', className, delay = 0 }: { value: number; tone?: 'wine' | 'ok' | 'warn' | 'ink' | 'gold'; className?: string; delay?: number }) {
  const color = { wine: 'bg-wine-500', ok: 'bg-ok-500', warn: 'bg-warn-500', ink: 'bg-ink-800', gold: 'bg-gold-500' }[tone]
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-ink-900/[.06]', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className={cn('h-full rounded-full', color)} initial={{ width: 0 }} animate={{ width: `${Math.min(100, value)}%` }} transition={{ duration: 0.8, delay, ease: [0.2, 0.8, 0.2, 1] }} />
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options, id, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[]; id: string; size?: 'sm' | 'md' }) {
  return (
    <div role="tablist" className="inline-flex rounded-[11px] bg-ink-900/[.05] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('relative flex items-center gap-1.5 rounded-lg font-medium transition-colors', size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]', value === o.value ? 'text-ink-900' : 'text-ink-500 hover:text-ink-800')}
        >
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-white shadow-soft ring-1 ring-ink-900/[.04]" transition={{ type: 'spring', bounce: 0, duration: 0.35 }} />}
          <span className="relative flex items-center gap-1.5">{o.icon}{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder, className, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">{placeholder ?? 'Search'}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input autoFocus={autoFocus} className="field pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type="search" />
    </label>
  )
}

export function Select({ value, onChange, children, className, label, id, disabled }: { value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string; label?: string; id?: string; disabled?: boolean }) {
  return (
    <div className={cn('relative', className)}>
      <select id={id} aria-label={label} disabled={disabled} className="field cursor-pointer appearance-none pr-9" value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
    </div>
  )
}

export function Field({ label, hint, error, children, htmlFor, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-bad-500">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', checked ? 'bg-wine-600' : 'bg-ink-900/15')}>
      <motion.span layout transition={{ type: 'spring', bounce: 0, duration: 0.25 }} className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow', checked ? 'right-0.5' : 'left-0.5')} />
    </button>
  )
}

export function Checkbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className="h-4 w-4 cursor-pointer rounded border-line-strong accent-wine-600"
    />
  )
}

/** Small anchored popover used for menus and the notification centre. */
export function Popover({ trigger, children, align = 'right', className }: { trigger: (p: { open: boolean; toggle: () => void }) => React.ReactNode; children: (close: () => void) => React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [open])
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15 }}
          className={cn('absolute top-full z-30 mt-2 origin-top rounded-xl border border-line bg-white shadow-lift', align === 'right' ? 'right-0' : 'left-0', className)}
        >
          {children(() => setOpen(false))}
        </motion.div>
      )}
    </div>
  )
}
