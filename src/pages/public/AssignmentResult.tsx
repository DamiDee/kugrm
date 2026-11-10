import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, CalendarClock, CalendarX2, ChevronDown, History, Hourglass, Mail, Phone, PhoneOff, RotateCcw, Search, Undo2, UserCheck } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { LIVE, type ApiError } from '@/lib/api'
import { availableLive, confirmLive, lookupLive, useLiveMap } from '@/lib/live'
import { lookupByPhone, positionsOf, spotOccupants, useEventData, useMemberMap, type AssignmentView, type LookupResult, type SessionEntry } from '@/lib/selectors'
import { cn, eventLabel, formatDate, formatPhone, formatShortDate, formatTime, fullName, sessionLine, sessionShort, telHref, SESSION_LABEL } from '@/lib/utils'
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

/** Live mode: the usher's number and a way to reload after they change something. */
const LiveCtx = createContext<{ phone: string; reload: () => Promise<void> }>({ phone: '', reload: async () => {} })

export default function AssignmentResult() {
  const [params] = useSearchParams()
  const phone = params.get('phone') ?? ''
  const navigate = useNavigate()
  // re-run the lookup whenever roster data changes (e.g. after confirming)
  const assignments = useStore((s) => s.assignments)
  const events = useStore((s) => s.events)
  const activeEventId = useStore((s) => s.activeEventId)
  const members = useStore((s) => s.members)
  const [ready, setReady] = useState(false)
  const demoResult = useMemo<LookupResult | null>(() => (!LIVE && phone ? lookupByPhone(phone) : null), [phone, assignments, events, activeEventId, members])
  const [liveResult, setLiveResult] = useState<LookupResult | null>(null)
  const [liveError, setLiveError] = useState('')
  const reload = useCallback(async () => {
    try {
      setLiveResult(await lookupLive(phone))
      setLiveError('')
    } catch (e) {
      setLiveError((e as Error).message)
    }
  }, [phone])
  useEffect(() => { if (LIVE && phone) void reload() }, [phone, reload])
  const result = LIVE ? liveResult : demoResult
  const live = useMemo(() => ({ phone, reload }), [phone, reload])

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
        {liveError ? (
          <div className="surface p-8 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-ink-900">We couldn’t check the roster</h1>
            <p className="mt-2 text-[15px] text-ink-500">{liveError}</p>
            <Button className="mt-5" variant="primary" onClick={() => void reload()}><RotateCcw className="h-4 w-4" /> Try again</Button>
          </div>
        ) : !ready || !result ? <ResultSkeleton /> : <LiveCtx.Provider value={live}><ResultBody result={result} /></LiveCtx.Provider>}
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
  return <MemberSessions result={result} />
}

const today = () => new Date().toISOString().slice(0, 10)

/** The usher's sessions in the current programme, one at a time. */
function MemberSessions({ result }: { result: Extract<LookupResult, { kind: 'member' }> }) {
  const { member, sessions, others } = result
  const [params, setParams] = useSearchParams()
  const activeEventId = useStore((s) => s.activeEventId)
  const fallback =
    sessions.find((x) => x.view && x.event.date >= today())?.event.id ??
    sessions.find((x) => x.event.id === activeEventId)?.event.id ??
    sessions[0]?.event.id
  const selectedId = sessions.some((x) => x.event.id === params.get('s')) ? params.get('s')! : fallback
  const entry = sessions.find((x) => x.event.id === selectedId) ?? sessions[0]
  const pickSession = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('s', id)
    setParams(next, { replace: true })
  }
  const event = entry?.event
  const view = entry?.view

  return (
    <div className="space-y-6">
      <motion.div {...fade}>
        <p className="text-sm text-ink-500">Welcome back</p>
        <h1 className="mt-1 text-[30px] font-semibold tracking-[-0.025em] text-ink-900 sm:text-[34px]">Hello, {member.firstName} <span aria-hidden>👋</span></h1>
        {event && (
          <p className="mt-1.5 text-[15px] text-ink-500">
            {event.name}{event.series && sessions.length > 1 ? `, ${formatDate(sessions[0].event.date, { day: 'numeric' })}–${formatDate(sessions[sessions.length - 1].event.date, { day: 'numeric', month: 'long', year: 'numeric' })}` : `, ${formatDate(event.date)}`}
          </p>
        )}
      </motion.div>

      {sessions.length > 1 && <SessionPicker sessions={sessions} value={selectedId} onChange={pickSession} />}

      {event && event.rosterStatus !== 'published' ? (
        <StatePanel
          icon={<CalendarClock className="h-6 w-6" />}
          badge="Roster coming soon"
          title={`${sessionLine(event) || event.name}: roster coming soon`}
          body="This session’s roster hasn’t been published yet. Check back closer to the day."
          event={event}
        />
      ) : event && !view ? (
        <StatePanel
          icon={<Hourglass className="h-6 w-6" />}
          badge="Not assigned"
          title="You’re not on this session’s roster"
          body={`We found your profile, but you don’t have a position for ${sessionShort(event)}. ${sessions.some((x) => x.view) ? 'Pick another session above to see where you serve.' : 'Your coordinator will let you know if that changes.'}`}
          event={event}
        />
      ) : view && view.assignment.status === 'unavailable' ? (
        <AwayPanel view={view} />
      ) : view ? (
        <Found view={view} />
      ) : null}

      {others.length > 0 && <OtherEvents others={others} />}
    </div>
  )
}

function SessionPicker({ sessions, value, onChange }: { sessions: SessionEntry[]; value?: string; onChange: (id: string) => void }) {
  return (
    <nav aria-label="Sessions" className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <ul className="flex gap-2">
        {sessions.map(({ event, view }) => {
          const on = event.id === value
          const state = event.rosterStatus !== 'published' ? 'Soon' : !view ? 'Off' : view.assignment.status === 'unavailable' ? 'Away' : view.zone.name.replace('Section ', 'Sec ')
          return (
            <li key={event.id} className="shrink-0">
              <button
                onClick={() => onChange(event.id)}
                aria-pressed={on}
                className={cn(
                  'flex min-h-[64px] w-[104px] flex-col items-start justify-center rounded-2xl px-3 py-2 text-left ring-1 transition-colors',
                  on ? 'bg-ink-950 text-white ring-ink-950' : 'bg-white text-ink-800 ring-line hover:ring-line-strong',
                )}
              >
                <span className={cn('text-[11px] font-semibold uppercase tracking-[0.08em]', on ? 'text-gold-300' : 'text-ink-500')}>
                  {formatDate(event.date, { weekday: 'short', day: 'numeric' })}
                </span>
                <span className="text-[14px] font-semibold">{event.session ? SESSION_LABEL[event.session] : event.code}</span>
                <span className={cn('mt-0.5 flex items-center gap-1 text-[11.5px]', on ? 'text-white/65' : 'text-ink-500')}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', state === 'Away' ? 'bg-bad-500' : state === 'Off' || state === 'Soon' ? 'bg-ink-300' : 'bg-ok-500')} />
                  <span className="truncate">{state}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function Found({ view }: { view: AssignmentView }) {
  const current = view
  const zones = useStore((s) => s.zones)
  const settings = useStore((s) => s.settings)
  const confirmAssignment = useStore((s) => s.confirmAssignment)
  const [showAll, setShowAll] = useState(false)
  const data = useEventData(current.event.id)
  const memberMap = useMemberMap()
  const live = useContext(LiveCtx)
  const liveMap = useLiveMap(current.event.id, current.position, current.teammates)
  const eventZones = LIVE ? liveMap.zones : zones.filter((z) => z.eventId === current.event.id)
  const demoOccupants = useMemo(() => spotOccupants(data, memberMap, current.zone.id), [data, memberMap, current.zone.id])
  const occupants = LIVE ? liveMap.occupants : demoOccupants
  const mapPositions = LIVE ? liveMap.positions : positionsOf(data)
  // the server already leaves out teammates who can't make it
  const team = LIVE ? current.teammates : current.teammates.filter((t) => t.isYou || data.assignments.some((a) => a.memberId === t.member.id))
  const confirm = async () => {
    try {
      if (LIVE) { await confirmLive(current.assignment.id, live.phone); await live.reload() } else confirmAssignment(current.assignment.id)
      toast.success('Attendance confirmed', 'Your lead can now see you’re coming.')
    } catch (e) {
      toast.error('Couldn’t confirm your attendance.', (e as Error).message)
    }
  }
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
      <AssignmentCard
        view={current}
        onConfirm={settings.allowSelfConfirm ? () => void confirm() : undefined}
      />
      <motion.section {...fade} transition={{ ...fade.transition, delay: 0.15 }} aria-labelledby="map-h">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 id="map-h" className="text-[17px] font-semibold tracking-tight text-ink-900">Where you’ll serve</h2>
            <p className="text-sm text-ink-500">{current.position.spot ? 'Your usher seat is marked on the floor plan.' : `${current.zone.name} is highlighted on the floor plan.`}</p>
          </div>
        </div>
        <VenueMap zones={eventZones} mode="locate" highlightZoneId={current.zone.id} highlightPositionId={current.position.id} positions={mapPositions} occupants={occupants} hideLegend pinLabel={current.position.spot ? 'You stand here' : `You · ${current.position.name}`} />
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
            <p className="text-sm text-ink-500">Other ushers in {current.zone.name} this session. Tap a number to call.</p>
          </div>
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink-600 ring-1 ring-line tabular">{team.length} ushers</span>
        </div>
        {current.coordinator && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-gold-100/60 px-4 py-3 ring-1 ring-gold-300/50">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-gold-700">Your coordinator</div>
              <div className="truncate font-medium text-ink-900">{fullName(current.coordinator)}</div>
            </div>
            <a href={telHref(current.coordinator.phone)} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-white px-3 text-[13px] font-medium text-ink-800 ring-1 ring-line">
              <Phone className="h-3.5 w-3.5 text-wine-500" /> {formatPhone(current.coordinator.phone)}
            </a>
          </div>
        )}
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

    </div>
  )
}

function AwayPanel({ view }: { view: AssignmentView }) {
  const undo = useStore((s) => s.undoUnavailable)
  const live = useContext(LiveCtx)
  const backLive = async () => {
    try {
      await availableLive(view.assignment.id, live.phone)
      await live.reload()
      toast.success('You’re back on the roster', `${view.zone.name} · ${view.position.name}`)
    } catch (e) {
      if ((e as ApiError).code === 'SPOT_COVERED') toast.error('Your place has been given to someone else', 'Call your coordinator to be placed again.')
      else toast.error('That wasn’t saved.', (e as Error).message)
    }
  }
  const back = () => {
    if (LIVE) return void backLive()
    if (undo(view.assignment.id)) toast.success('You’re back on the roster', `${view.zone.name} · ${view.position.name}`)
    else toast.error('Your place has been given to someone else', 'Call your coordinator to be placed again.')
  }
  return (
    <StatePanel
      icon={<CalendarX2 className="h-6 w-6" />}
      badge="Can’t make it"
      tone="bad"
      title={`You told us you can’t make ${sessionShort(view.event)}`}
      body={`Your ${view.position.spot ? 'seat' : 'place'} at ${view.zone.name} (${view.position.name}) is open for cover this session.${view.assignment.unavailableReason ? ` Reason: ${view.assignment.unavailableReason}.` : ''}`}
      event={view.event}
      action={<Button variant="primary" onClick={back}><Undo2 className="h-4 w-4" /> I can come after all</Button>}
    />
  )
}

function StatePanel({ icon, badge, title, body, event, action, tone = 'warn' }: { icon: React.ReactNode; badge: string; title: string; body: string; event: AssignmentView['event']; action?: React.ReactNode; tone?: 'warn' | 'bad' }) {
  const navigate = useNavigate()
  return (
    <motion.section {...fade} transition={{ ...fade.transition, delay: 0.08 }} className="surface overflow-hidden">
      <div className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:p-8">
        <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1', tone === 'bad' ? 'bg-bad-50 text-bad-600 ring-bad-500/20' : 'bg-warn-50 text-warn-600 ring-warn-500/20')}>{icon}</span>
        <div>
          <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset', tone === 'bad' ? 'bg-bad-50 text-bad-600 ring-bad-500/20' : 'bg-warn-50 text-warn-600 ring-warn-500/20')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', tone === 'bad' ? 'bg-bad-500' : 'bg-warn-500')} />{badge}
          </span>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink-900">{title}</h2>
          <p className="mt-1.5 max-w-lg text-[15px] leading-relaxed text-ink-500">{body}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {action}
            <Button variant="secondary" onClick={() => navigate('/')}><ArrowLeft className="h-4 w-4" /> Back to search</Button>
            {!action && <Button variant="ghost" onClick={() => navigate('/help')}><UserCheck className="h-4 w-4" /> What happens next?</Button>}
          </div>
        </div>
      </div>
      <div className="border-t border-line bg-paper px-6 py-5 sm:px-8">
        <div className="eyebrow mb-1">{sessionLine(event) || 'Event'}</div>
        <EventInfo event={event} />
      </div>
    </motion.section>
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
                      <div className="truncate font-medium text-ink-900">{o.event.series ? eventLabel(o.event) : o.event.name}</div>
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

