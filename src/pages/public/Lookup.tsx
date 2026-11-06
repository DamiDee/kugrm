import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarDays, Clock3, MapPin, Shirt } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useEventData } from '@/lib/selectors'
import { formatDate, formatTime } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { FloorplanTexture, PublicFooter, PublicNav } from '@/components/public/PublicShell'
import { PhoneLookup } from '@/components/public/PhoneLookup'

const ease = [0.2, 0.8, 0.2, 1] as const

export default function Lookup() {
  const activeEventId = useStore((s) => s.activeEventId)
  const members = useStore((s) => s.members)
  const { event, stats } = useEventData(activeEventId)
  const published = event?.rosterStatus === 'published'
  const faces = members.slice(1, 5)

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <div className="p-2 sm:p-3 md:p-4">
        <main className="relative isolate overflow-hidden rounded-[22px] bg-ink-950 text-white sm:rounded-shell md:min-h-[calc(100dvh-2rem)]">
          {/* atmosphere: restrained, two soft light sources and a floor-plan texture */}
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_15%_100%,rgba(147,48,78,.38),transparent_70%),radial-gradient(50%_50%_at_95%_0%,rgba(197,158,79,.16),transparent_70%)]" />
          <FloorplanTexture className="-z-10 text-white/[.06]" />

          <PublicNav />

          <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-8 pt-10 md:px-8 md:pt-16 lg:grid-cols-[1.25fr_.75fr] lg:gap-14 lg:pb-14 lg:pt-24">
            <section aria-labelledby="find-heading" className="flex flex-col justify-center">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/[.07] px-3 py-1 text-xs font-medium text-white/75 ring-1 ring-white/10">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-300" />
                  Koinonia Global · Ushering Department
                </span>
                <h1 id="find-heading" className="mt-6 text-[44px] font-light leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[76px]">
                  Find your
                  <br />
                  <span className="text-white/55">assignment.</span>
                </h1>
                <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-white/60">
                  Enter your registered phone number to view your assignment for the current event.
                </p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08, ease }} className="mt-8 max-w-xl">
                <PhoneLookup />
                <p className="mt-4 px-2 text-xs text-white/40">No account needed. Your number is only used to find your roster entry.</p>
              </motion.div>
            </section>

            {event && (
              <motion.aside
                aria-label="Active event"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.16, ease }}
                className="flex flex-col justify-end gap-3"
              >
                <div className="rounded-[26px] bg-white/[.08] p-6 ring-1 ring-white/[.12] backdrop-blur-xl">
                  <div className="flex items-start justify-between gap-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9BE0BC] ring-1 ring-ok-500/30">
                      <span className="relative flex h-1.5 w-1.5"><span className="absolute inset-0 animate-ping rounded-full bg-[#9BE0BC]" /><span className="relative h-1.5 w-1.5 rounded-full bg-[#9BE0BC]" /></span>
                      Active Event
                    </span>
                    <Link to="/help" aria-label="How lookup works" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink-900 transition-transform hover:-translate-y-0.5">
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <h2 className="mt-5 text-[22px] font-medium leading-snug tracking-[-0.01em]">{event.name}</h2>
                  <dl className="mt-5 grid grid-cols-1 gap-3 text-sm text-white/70 sm:grid-cols-2 lg:grid-cols-1">
                    <Meta icon={<CalendarDays className="h-4 w-4" />} label="Date">{formatDate(event.date)}</Meta>
                    <Meta icon={<MapPin className="h-4 w-4" />} label="Venue">{event.venue}</Meta>
                    <Meta icon={<Clock3 className="h-4 w-4" />} label="Reporting time">Report by {formatTime(event.reportingTime)}</Meta>
                    {event.dressCode && <Meta icon={<Shirt className="h-4 w-4" />} label="Dress code">{event.dressCode}</Meta>}
                  </dl>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-[26px] bg-canvas p-5 text-ink-900">
                  <div>
                    <div className="text-[30px] font-semibold leading-none tracking-[-0.03em] tabular">{published ? stats.assigned.toLocaleString() : '—'}</div>
                    <div className="mt-1.5 text-xs text-ink-500">{published ? `Ushers on the ${event.code} roster` : 'Roster not yet published'}</div>
                  </div>
                  <div className="flex -space-x-2">
                    {faces.map((m) => <Avatar key={m.id} first={m.firstName} last={m.lastName} size="sm" ring />)}
                  </div>
                </div>
              </motion.aside>
            )}
          </div>
        </main>
      </div>
      <PublicFooter />
    </div>
  )
}

function Meta({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[.07] text-gold-300">{icon}</span>
      <div>
        <dt className="sr-only">{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  )
}
