import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Copy, Crown, Info, Phone } from 'lucide-react'
import type { MinistryEvent } from '@/data/types'
import type { AssignmentView, Teammate } from '@/lib/selectors'
import { cn, formatDate, formatPhone, formatTime, fullName, telHref } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { StatusBadge } from '@/components/ui/Badge'
import { leadLabel, zoneNote } from '@/data/venue'

export function AssignmentCard({ view, onConfirm }: { view: AssignmentView; onConfirm?: () => void }) {
  const { event, zone, position, teamLead, assignment } = view
  const lead = leadLabel(zone)
  const note = zoneNote(zone)
  return (
    <motion.section
      aria-label="Your assignment"
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative overflow-hidden rounded-[26px] bg-ink-950 text-white shadow-float"
    >
      <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_100%_0%,rgba(147,48,78,.45),transparent_70%)]" />
      <div className="relative p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300">Your assignment</span>
          <StatusBadge status={assignment.status} className="bg-white/10 text-white ring-white/15" />
        </div>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45 }}
          className={cn('mt-5 font-light uppercase leading-[.95] tracking-[-0.03em]', zone.name.length > 14 ? 'text-[40px] sm:text-[52px]' : 'text-[56px] sm:text-[76px]')}
        >
          {zone.name}
        </motion.h2>
        {note && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }} className="mt-2 text-[15px] text-gold-300/90">{note}</motion.p>}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }} className="mt-4 flex items-center gap-3">
          <span className="h-px w-8 bg-gold-300/70" />
          <span className="text-sm text-white/55">Position</span>
          <span className="text-xl font-medium tracking-tight">{position.name}</span>
          {assignment.isTeamLead && <span className="inline-flex items-center gap-1 rounded-full bg-gold-300/15 px-2 py-0.5 text-xs text-gold-300"><Crown className="h-3 w-3" /> Team lead</span>}
        </motion.div>
      </div>
      <dl className="relative grid grid-cols-2 border-t border-white/10 text-sm sm:grid-cols-4">
        {[
          ['Event', event.code],
          ['Reporting time', formatTime(event.reportingTime)],
          ['Venue', event.venue.split(',')[0]],
          [lead, teamLead ? fullName(teamLead) : 'To be announced'],
        ].map(([k, v], i) => (
          <div key={k} className={cn('px-6 py-4 sm:px-8', i % 2 === 1 && 'border-l border-white/10', i >= 2 && 'border-t border-white/10 sm:border-t-0', i >= 1 && 'sm:border-l')}>
            <dt className="text-xs text-white/45">{k}</dt>
            <dd className="mt-1 font-medium text-white">{v}</dd>
          </div>
        ))}
      </dl>
      {onConfirm && assignment.status === 'assigned' && (
        <div className="relative flex flex-col items-start justify-between gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:px-8">
          <p className="text-sm text-white/60">Let your {lead.toLowerCase()} know you’ll be there.</p>
          <button onClick={onConfirm} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink-900 transition-transform hover:-translate-y-0.5">
            <Check className="h-4 w-4" /> Confirm attendance
          </button>
        </div>
      )}
    </motion.section>
  )
}

export function Notice({ text }: { text: string }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-gold-300/50 bg-gold-100/50 p-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-gold-600 ring-1 ring-gold-300/60"><Info className="h-4 w-4" /></span>
      <div>
        <h3 className="text-sm font-semibold text-ink-900">Important notice</h3>
        <p className="mt-1 text-[14.5px] leading-relaxed text-ink-700">{text}</p>
      </div>
    </div>
  )
}

export function TeamMemberRow({ t, showPhone }: { t: Teammate; showPhone: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(t.member.phone) } catch { /* clipboard blocked */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }
  return (
    <li className={cn('group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-paper', t.isYou && 'bg-wine-50/60 hover:bg-wine-50')}>
      <Avatar first={t.member.firstName} last={t.member.lastName} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-medium text-ink-900">{fullName(t.member)}</span>
          {t.isYou && <span className="rounded-full bg-wine-600 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-white">You</span>}
          {t.isTeamLead && <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-gold-700 ring-1 ring-gold-300/60"><Crown className="h-3 w-3" />Lead</span>}
        </div>
        <div className="mt-0.5 text-[13px] text-ink-500">{t.position.name}</div>
      </div>
      {showPhone && !t.isYou && (
        <div className="flex items-center gap-1">
          <a href={telHref(t.member.phone)} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-[13px] font-medium text-ink-700 tabular ring-1 ring-line transition-colors hover:bg-white hover:ring-line-strong" aria-label={`Call ${fullName(t.member)}`}>
            <Phone className="h-3.5 w-3.5 text-wine-500" />
            <span className="hidden sm:inline">{formatPhone(t.member.phone)}</span>
            <span className="sm:hidden">Call</span>
          </a>
          <button onClick={copy} className="relative hidden h-10 w-10 items-center justify-center rounded-full text-ink-400 hover:bg-white hover:text-ink-700 sm:flex" aria-label="Copy phone number">
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span key="c" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}><Check className="h-4 w-4 text-ok-500" /></motion.span>
              ) : (
                <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Copy className="h-4 w-4" /></motion.span>
              )}
            </AnimatePresence>
            {copied && <span className="absolute -top-7 whitespace-nowrap rounded bg-ink-900 px-1.5 py-0.5 text-[11px] text-white">Copied</span>}
          </button>
        </div>
      )}
    </li>
  )
}

export function EventInfo({ event }: { event: MinistryEvent }) {
  const rows: [string, string | undefined][] = [
    ['Event', event.name],
    ['Date', formatDate(event.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
    ['Venue', event.venue],
    ['Reporting time', `Report by ${formatTime(event.reportingTime)}`],
    ['Team briefing', event.briefingTime ? formatTime(event.briefingTime) : undefined],
    ['Dress code', event.dressCode],
  ]
  return (
    <dl className="divide-y divide-line">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-6 py-3 text-sm">
          <dt className="shrink-0 text-ink-500">{k}</dt>
          <dd className="text-right font-medium text-ink-900">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
