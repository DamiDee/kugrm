import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Clock3, MapPin, ShieldCheck, Sun, Sunset } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { sessionsOf, useEventData } from '@/lib/selectors'
import { formatDate, formatTime } from '@/lib/utils'
import { PublicFooter, PublicNav } from '@/components/public/PublicShell'
import { PhoneLookup } from '@/components/public/PhoneLookup'
import type { MinistryEvent } from '@/data/types'

const ease = [0.2, 0.8, 0.2, 1] as const

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

/** "18TH – 22ND" and "NOVEMBER 2026" for a run of sessions. */
function dateRange(sessions: MinistryEvent[]) {
  const first = new Date(sessions[0].date + 'T12:00')
  const last = new Date(sessions[sessions.length - 1].date + 'T12:00')
  const days = first.getTime() === last.getTime() ? ordinal(first.getDate()) : `${ordinal(first.getDate())} – ${ordinal(last.getDate())}`
  return { days: days.toUpperCase(), month: last.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase() }
}

/**
 * The usher landing page, in the colours of The General Assembly flyers:
 * black, metallic gold and white, with the red time bar.
 */
export default function Lookup() {
  const activeEventId = useStore((s) => s.activeEventId)
  const events = useStore((s) => s.events)
  const { event, stats } = useEventData(activeEventId)
  const sessions = event ? sessionsOf(events, event) : []
  const published = event?.rosterStatus === 'published'
  const range = sessions.length ? dateRange(sessions) : undefined
  const morning = sessions.find((e) => e.session === 'morning')
  const evening = sessions.find((e) => e.session === 'evening')
  const times = [morning?.startTime, evening?.startTime].filter(Boolean).map((t) => formatTime(t).replace(' ', '')).join(' & ')
  const venue = event?.venue.split(',') ?? []

  return (
    <div className="min-h-[100dvh] bg-tga-black">
      <div className="p-2 sm:p-3 md:p-4">
        <main className="relative isolate overflow-hidden rounded-[22px] bg-tga-black text-white ring-1 ring-white/[.06] sm:rounded-shell md:min-h-[calc(100dvh-2rem)]">
          {/* gold light, as on the flyer */}
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(55%_55%_at_100%_10%,rgba(217,180,90,.26),transparent_70%),radial-gradient(45%_50%_at_0%_100%,rgba(169,121,43,.22),transparent_70%)]" />
          <GoldSwirl />

          <PublicNav tga />

          <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-8 pt-8 md:px-8 md:pt-14 lg:grid-cols-[1.2fr_.8fr] lg:gap-14 lg:pb-14 lg:pt-20">
            <section aria-labelledby="find-heading" className="flex flex-col justify-center">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/[.06] px-3 py-1 text-xs font-medium text-white/75 ring-1 ring-white/10">
                  <span className="h-1.5 w-1.5 rounded-full bg-tga-gold" />
                  Koinonia Global · Ushering Department
                </span>
                {event?.series && (
                  <p className="mt-6 text-[14px] font-medium tracking-[-0.005em] text-tga-gold">The {event.name.replace(/^The /, '')}</p>
                )}
                <h1 id="find-heading" className="mt-3 text-[52px] font-light leading-[1.02] tracking-[-0.04em] sm:text-[72px] lg:text-[88px]">
                  Find your
                  <br />
                  <span className="tga-gold-text">post.</span>
                </h1>
                {event?.theme && (
                  <p className="mt-5 flex items-center gap-3 text-[13px] uppercase tracking-[0.22em] text-tga-cream/80">
                    <span className="h-px w-8 bg-tga-gold/70" />Theme · {event.theme.replace(/\s*\(.*\)/, '')}
                  </p>
                )}
                <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-white/60">
                  Enter your registered phone number to see your seat or post for each session, who you serve with, and when to report.
                </p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08, ease }} className="mt-8 max-w-xl">
                <PhoneLookup tga />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-2 text-xs text-white/40">
                  <span>No account needed. Your number is only used to find your roster entry.</span>
                  <Link to="/team/login" className="inline-flex items-center gap-1.5 font-medium text-tga-gold hover:text-tga-cream"><ShieldCheck className="h-3.5 w-3.5" /> Coordinator sign-in</Link>
                </div>
              </motion.div>
            </section>

            {event && (
              <motion.aside
                aria-label="Current event"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.16, ease }}
                className="flex flex-col justify-end gap-3"
              >
                <div className="relative overflow-hidden rounded-[26px] bg-tga-night p-6 ring-1 ring-tga-gold/25">
                  <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-tga-gold/10 blur-2xl" />
                  <div className="relative flex items-start justify-between gap-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-tga-gold/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-tga-gold ring-1 ring-tga-gold/30">
                      <span className="relative flex h-1.5 w-1.5"><span className="absolute inset-0 animate-ping rounded-full bg-tga-gold" /><span className="relative h-1.5 w-1.5 rounded-full bg-tga-gold" /></span>
                      {event.series ?? 'Active event'}
                    </span>
                    <Link to="/help" aria-label="How lookup works" className="tga-gold-bg flex h-10 w-10 items-center justify-center rounded-full text-tga-black transition-transform hover:-translate-y-0.5">
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                  {range ? (
                    <div className="relative mt-5 leading-[1.05] tracking-[-0.03em]">
                      <div className="text-[44px] font-light sm:text-[52px]">{range.days}</div>
                      <div className="text-[34px] font-light text-white/90 sm:text-[40px]">{range.month}</div>
                    </div>
                  ) : (
                    <h2 className="relative mt-5 text-[22px] font-medium">{event.name}</h2>
                  )}
                  {times && (
                    <div className="relative mt-4 inline-block bg-tga-red px-3 py-1.5 text-[20px] font-semibold tracking-[-0.01em]">{times}</div>
                  )}
                  <div className="relative mt-5 flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[.06] text-tga-gold"><MapPin className="h-4 w-4" /></span>
                    <div>
                      <div className="text-[16px] font-semibold tracking-[-0.01em]">{venue[0]}</div>
                      <div className="text-[13px] leading-snug text-white/55">{venue.slice(1).join(',').trim()}</div>
                    </div>
                  </div>
                  {(morning || evening) && (
                    <dl className="relative mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 text-sm">
                      {[morning, evening].filter(Boolean).map((e) => (
                        <div key={e!.session} className="bg-tga-night/90 px-4 py-3">
                          <dt className="flex items-center gap-1.5 text-xs text-white/50">{e!.session === 'morning' ? <Sun className="h-3.5 w-3.5 text-tga-gold" /> : <Sunset className="h-3.5 w-3.5 text-tga-gold" />}{e!.session === 'morning' ? 'Mornings' : 'Evenings'}</dt>
                          <dd className="mt-1 font-medium">Report {formatTime(e!.reportingTime)}</dd>
                          {e!.startTime && <dd className="text-xs text-white/50">Service {formatTime(e!.startTime)}</dd>}
                        </div>
                      ))}
                    </dl>
                  )}
                  {!event.series && (
                    <p className="relative mt-4 flex items-center gap-2 text-sm text-white/60"><Clock3 className="h-4 w-4 text-tga-gold" />{formatDate(event.date)} · report by {formatTime(event.reportingTime)}</p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 rounded-[26px] bg-tga-cream p-5 text-tga-black">
                  <div>
                    <div className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular">{published ? stats.assigned.toLocaleString() : '—'}</div>
                    <div className="mt-1.5 text-xs text-tga-black/60">{published ? `Ushers serving ${event.series ? 'Day ' + event.day + (event.session ? `, ${event.session}` : '') : event.code}` : 'Roster not yet published'}</div>
                  </div>
                  <div className="text-right text-xs text-tga-black/60">
                    <div className="font-semibold text-tga-black">{sessions.filter((e) => e.rosterStatus === 'published').length} of {sessions.length || 1}</div>
                    sessions published
                  </div>
                </div>
              </motion.aside>
            )}
          </div>
        </main>
      </div>
      <div className="bg-tga-black text-white/50 [&_a:hover]:text-white [&_footer]:text-white/45">
        <PublicFooter />
      </div>
    </div>
  )
}

/** Faint gold ribbon lines, a nod to the ribbon on the flyer. */
function GoldSwirl() {
  return (
    <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 -z-10 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="tga-ribbon" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#F6DD97" stopOpacity=".0" />
          <stop offset=".5" stopColor="#D9B45A" stopOpacity=".22" />
          <stop offset="1" stopColor="#A9792B" stopOpacity=".0" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#tga-ribbon)" strokeWidth="1.4">
        {Array.from({ length: 7 }).map((_, i) => (
          <path key={i} d={`M${560 + i * 28} -40 C ${760 + i * 20} ${180 + i * 10}, ${1240 - i * 14} ${260 + i * 18}, ${980 - i * 8} ${860}`} />
        ))}
      </g>
    </svg>
  )
}
