import { cn } from '@/lib/utils'

export type Tone = 'neutral' | 'success' | 'warn' | 'danger' | 'wine' | 'gold' | 'info' | 'dark'

const tones: Record<Tone, string> = {
  neutral: 'bg-ink-900/[.05] text-ink-700 ring-ink-900/[.06]',
  success: 'bg-ok-50 text-ok-600 ring-ok-500/15',
  warn: 'bg-warn-50 text-warn-600 ring-warn-500/20',
  danger: 'bg-bad-50 text-bad-600 ring-bad-500/15',
  wine: 'bg-wine-50 text-wine-700 ring-wine-500/15',
  gold: 'bg-gold-100 text-gold-700 ring-gold-500/25',
  info: 'bg-[#EEF3FA] text-[#2D4E7A] ring-[#2D4E7A]/10',
  dark: 'bg-ink-900 text-white ring-ink-900',
}
const dots: Record<Tone, string> = {
  neutral: 'bg-ink-400', success: 'bg-ok-500', warn: 'bg-warn-500', danger: 'bg-bad-500', wine: 'bg-wine-500', gold: 'bg-gold-500', info: 'bg-[#4A74AE]', dark: 'bg-gold-300',
}

export function Badge({ tone = 'neutral', dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} aria-hidden />}
      {children}
    </span>
  )
}

const STATUS: Record<string, { tone: Tone; label: string }> = {
  draft: { tone: 'neutral', label: 'Draft' },
  active: { tone: 'success', label: 'Active' },
  completed: { tone: 'info', label: 'Completed' },
  archived: { tone: 'neutral', label: 'Archived' },
  published: { tone: 'success', label: 'Published' },
  unpublished: { tone: 'warn', label: 'Unpublished' },
  assigned: { tone: 'wine', label: 'Assigned' },
  confirmed: { tone: 'success', label: 'Confirmed' },
  unassigned: { tone: 'warn', label: 'Unassigned' },
  inactive: { tone: 'neutral', label: 'Inactive' },
  awaiting: { tone: 'warn', label: 'Awaiting Assignment' },
}

export function StatusBadge({ status, className }: { status: keyof typeof STATUS | string; className?: string }) {
  const s = STATUS[status] ?? { tone: 'neutral' as Tone, label: status }
  return <Badge tone={s.tone} dot className={className}>{s.label}</Badge>
}
