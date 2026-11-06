import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, CalendarClock, ChevronDown, History, Hourglass, Mail, PhoneOff, RotateCcw, Search, UserCheck } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { lookupByPhone, positionsOf, spotOccupants, useEventData, useMemberMap, type AssignmentView, type LookupResult } from '@/lib/selectors'
import { cn, formatDate, formatPhone, formatShortDate, formatTime, telHref } from '@/lib/utils'
import { Logo, Segmented } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { VenueMap } from '@/components/venue/VenueMap'
import { leadLabel } from '@/data/venue'
import { AssignmentCard, EventInfo, Notice, TeamMemberRow } from '@/components/public/AssignmentParts'
import { PhoneLookup } from '@/components/public/PhoneLookup'
import { PublicFooter } from '@/components/public/PublicShell'

const fade = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] } }

export default function AssignmentResult() {
  const [params] = useSearchParams()
  const phone = params.get('phone') ?? ''
  const navigate = useNavigate()
  // re-run the lookup whenever roster data changes (e.g. after confirming)
  const assignments = useStore((s) => s.assignments)
  const events = useStore((s) => s.events)
  const activeEventId = useStore((s) => s.activeEventId)
  const [ready, setReady] = useState(false)
  const result = useMemo<LookupResult | null>(() => (phone ? lookupByPhone(phone) : null), [phone, assignments, events, activeEventId])

  useEffect(() => {
    if (!phone) navigate('/', { replace: true })
    const t = setTimeout(() => setReady(true), 120)
    return () => clearTimeout(t)
  }, [phone, navigate])

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Back to lookup"><Logo /></Link>
          <Button size="sm" variant="secondary" onClick={() => navigate('/')}>
            <Search className="h-3.5 w-3.5" /> New search
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
        {!ready || !result ? <ResultSkeleton /> : <ResultBody result={result} />}
      </main>
      <PublicFooter />
    </div>
  )
}

function ResultSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Checking the roster">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="mt-6 h-72 w-full rounded-[26px]" />
    </div>
  )
}

function ResultBody({ result }: { result: LookupResult }) {
  if (result.kind === 'not-found') return <NotFound phone={result.phone} />
  if (result.kind === 'unpublished')
    return (
      <StateScreen
        icon={<CalendarClock className="h-6 w-6" />}
        badge="Roster Coming Soon"
        title="Roster coming soon"
        body={`The roster for ${result.event.name} has not been published yet. Check back closer to the event.`}
        name={result.member.firstName}
        others={result.others}
      />
    )
  if (result.kind === 'unassigned')
    return (
      <StateScreen
        icon={<Hourglass className="h-6 w-6" />}
        badge="Awaiting Assignment"
        title="Your roster is not available yet"
        body={`We found your department profile, but you have not been assigned to a working position for ${result.event.code}.`}
        name={result.member.firstName}
        others={result.others}
      />
    )
  return <Found result={result} />
}

function Found({ result }: { result: Extract<LookupResult, { kind: 'found' }> }) {
  const { member, current, others } = result
  const zones = useStore((s) => s.zones)
  const settings = useStore((s) => s.settings)
  const confirmAssignment = useStore((s) => s.confirmAssignment)
  const [showAll, setShowAll] = useState(false)
  const eventZones = zones.filter((z) => z.eventId === current.event.id)
  const data = useEventData(current.event.id)
  const memberMap = useMemberMap()
  const occupants = useMemo(() => spotOccupants(data, memberMap, current.zone.id), [data, memberMap, current.zone.id])
  const team = current.teammates
  const visible = showAll ? team : team.slice(0, 8)

  // group teammates by position for larger teams
  const grouped = useMemo(() => {
    const m = new Map<string, typeof team>()
    visible.forEach((t) => {
      const key = t.isTeamLead ? 'Lead' : t.position.name
      m.set(key, [...(m.get(key) ?? []), t])
    })
    return [...m.entries()]
  }, [visible])

  return (
    <div className="space-y-8">
      <motion.div {...fade}>
        <p className="text-sm text-ink-500">Welcome back</p>
        <h1 className="mt-1 text-[30px] font-semibold tracking-[-0.025em] text-ink-900 sm:text-[34px]">Hello, {member.firstName} <span aria-hidden>👋</span></h1>
        <p className="mt-1.5 text-[15px] text-ink-500">Here is your assignment for {current.event.code}.</p>
      </motion.div>

      <AssignmentCard
        view={current}
        onConfirm={settings.allowSelfConfirm ? () => { confirmAssignment(current.assignment.id); toast.success('Attendance confirmed', 'Your lead can now see you’re coming.') } : undefined}
      />

      <motion.section {...fade} transition={{ ...fade.transition, delay: 0.15 }} aria-labelledby="map-h">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 id="map-h" className="text-[17px] font-semibold tracking-tight text-ink-900">Where you’ll serve</h2>
            <p className="text-sm text-ink-500">{current.position.spot ? 'Your usher spot is marked on the venue map.' : `${current.zone.name} is highlighted on the venue map.`}</p>
          </div>
        </div>
        <VenueMap zones={eventZones} mode="locate" highlightZoneId={current.zone.id} highlightPositionId={current.position.id} positions={positionsOf(data)} occupants={occupants} pinLabel={current.position.spot ? 'You stand here' : `You · ${current.position.name}`} />
      </motion.section>

      {current.event.instructions && (
        <motion.div {...fade} transition={{ ...fade.transition, delay: 0.2 }}>
          <Notice text={current.event.instructions} />
        </motion.div>
      )}

      <motion.section {...fade} transition={{ ...fade.transition, delay: 0.25 }} aria-labelledby="team-h">
        <div className="mb-2 flex items-end justify-between gap-4">
          <div>
            <h2 id="team-h" className="text-[17px] font-semibold tracking-tight text-ink-900">Your team</h2>
            <p className="text-sm text-ink-500">Other ushers assigned to {current.zone.name}. Tap a number to call.</p>
          </div>
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink-600 ring-1 ring-line tabular">{team.length} ushers</span>
        </div>
        <div className="surface p-2">
          {grouped.map(([pos, list]) => (
            <div key={pos} className="pb-1">
              <div className="eyebrow px-3 pb-1 pt-3">{pos === 'Lead' ? leadLabel(current.zone) : pos}</div>
              <ul>{list.map((t) => <TeamMemberRow key={t.member.id} t={t} showPhone={settings.showTeammatePhones} />)}</ul>
            </div>
          ))}
          {team.length > 8 && (
            <button onClick={() => setShowAll((s) => !s)} className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-medium text-wine-600 hover:bg-wine-50/60">
              {showAll ? 'Show fewer' : `Show all ${team.length} teammates`}
              <ChevronDown className={cn('h-4 w-4 transition-transform', showAll && 'rotate-180')} />
            </button>
          )}
        </div>
      </motion.section>

      <motion.section {...fade} transition={{ ...fade.transition, delay: 0.3 }} aria-labelledby="info-h" className="grid gap-6 sm:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 id="info-h" className="text-[17px] font-semibold tracking-tight text-ink-900">Event information</h2>
          <p className="mt-1 text-sm text-ink-500">{current.event.description}</p>
        </div>
        <EventInfo event={current.event} />
      </motion.section>

      {others.length > 0 && <OtherEvents others={others} />}
    </div>
  )
}

function OtherEvents({ others }: { others: AssignmentView[] }) {
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = others.filter((o) => o.event.date >= today && o.event.status !== 'completed')
  const previous = others.filter((o) => !upcoming.includes(o)).reverse()
  const [tab, setTab] = useState<'upcoming' | 'previous'>(upcoming.length ? 'upcoming' : 'previous')
  const [open, setOpen] = useState(false)
  const list = tab === 'upcoming' ? upcoming : previous
  return (
    <section className="border-t border-line pt-6">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between text-left">
        <span>
          <span className="block text-[15px] font-semibold text-ink-900">Other events</span>
          <span className="text-sm text-ink-500">{upcoming.length} upcoming · {previous.length} previous</span>
        </span>
        <ChevronDown className={cn('h-5 w-5 text-ink-400 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-4">
              <Segmented id="other" size="sm" value={tab} onChange={setTab} options={[{ value: 'upcoming', label: 'Upcoming', icon: <CalendarClock className="h-3.5 w-3.5" /> }, { value: 'previous', label: 'Previous', icon: <History className="h-3.5 w-3.5" /> }]} />
              <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
                {list.length === 0 && <li className="px-5 py-6 text-center text-sm text-ink-500">Nothing here yet.</li>}
                {list.map((o) => (
                  <li key={o.assignment.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink-900">{o.event.name}</div>
                      <div className="text-[13px] text-ink-500">{formatShortDate(o.event.date)} · Report {formatTime(o.event.reportingTime)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-ink-900">{o.zone.name}</div>
                      <div className="text-[13px] text-ink-500">{o.position.name}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function NotFound({ phone }: { phone: string }) {
  const settings = useStore((s) => s.settings)
  const [retry, setRetry] = useState(false)
  return (
    <motion.div {...fade} className="mx-auto max-w-xl pt-6 text-center">
      <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-dashed border-line-strong" />
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink-500 ring-1 ring-line"><PhoneOff className="h-5 w-5" /></span>
      </div>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink-900">We couldn’t find an assignment</h1>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-ink-500">
        Check that the phone number matches the number registered with the department.
      </p>
      <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm ring-1 ring-line">
        <span className="text-ink-500">You searched</span>
        <span className="font-semibold text-ink-900 tabular">{formatPhone(phone)}</span>
      </div>
      <AnimatePresence mode="wait">
        {retry ? (
          <motion.div key="f" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-8 text-left">
            <PhoneLookup onDark={false} />
          </motion.div>
        ) : (
          <motion.div key="b" className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
            <Button variant="primary" size="lg" onClick={() => setRetry(true)}><RotateCcw className="h-4 w-4" /> Try another number</Button>
            <a href={telHref(settings.contactPhone)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-[15px] font-medium text-ink-800 shadow-soft hover:border-line-strong">
              <Mail className="h-4 w-4" /> Contact administrator
            </a>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="mt-6 text-xs text-ink-500">{settings.contactName} · {formatPhone(settings.contactPhone)}</p>
    </motion.div>
  )
}

function StateScreen({ icon, badge, title, body, name, others }: { icon: React.ReactNode; badge: string; title: string; body: string; name: string; others: AssignmentView[] }) {
  const navigate = useNavigate()
  const activeEventId = useStore((s) => s.activeEventId)
  const event = useStore((s) => s.events.find((e) => e.id === activeEventId))
  return (
    <div className="space-y-8">
      <motion.div {...fade}>
        <p className="text-sm text-ink-500">Welcome back</p>
        <h1 className="mt-1 text-[30px] font-semibold tracking-[-0.025em] text-ink-900">Hello, {name} <span aria-hidden>👋</span></h1>
      </motion.div>
      <motion.section {...fade} transition={{ ...fade.transition, delay: 0.08 }} className="surface overflow-hidden">
        <div className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:p-8">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-warn-50 text-warn-600 ring-1 ring-warn-500/20">{icon}</span>
          <div>
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-warn-50 px-2.5 text-xs font-medium text-warn-600 ring-1 ring-inset ring-warn-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-warn-500" />{badge}
            </span>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink-900">{title}</h2>
            <p className="mt-1.5 max-w-lg text-[15px] leading-relaxed text-ink-500">{body}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => navigate('/')}><ArrowLeft className="h-4 w-4" /> Back to search</Button>
              <Button variant="ghost" onClick={() => navigate('/help')}><UserCheck className="h-4 w-4" /> What happens next?</Button>
            </div>
          </div>
        </div>
        {event && (
          <div className="border-t border-line bg-paper px-6 py-5 sm:px-8">
            <div className="eyebrow mb-1">Current event</div>
            <EventInfo event={event} />
          </div>
        )}
      </motion.section>
      {others.length > 0 && <OtherEvents others={others} />}
      <p className="text-center text-xs text-ink-500">{event && `${event.code} · ${formatDate(event.date)}`}</p>
    </div>
  )
}
