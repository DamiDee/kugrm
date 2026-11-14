import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { CalendarX2, ChevronDown, Crown, LogOut, Phone, Users } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { LIVE, tokens, type ApiError } from '@/lib/api'
import { loadTeam } from '@/lib/live'
import { leadersForMember, leadersForZone, positionsOf, sessionsOf, spotOccupants, teamScope, uncoveredSpots, useEventData, useMemberMap, type EventData } from '@/lib/selectors'
import type { Member } from '@/data/types'
import { cn, formatDate, formatPhone, formatTime, fullName, sessionLine, telHref } from '@/lib/utils'
import { Logo } from '@/components/ui/misc'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { VenueMap } from '@/components/venue/VenueMap'
import { Absences } from '@/components/admin/Absences'
import { ZoneRosterCard, useZoneRosters, zoneSummary, type ZoneRoster } from '@/components/team/TeamParts'

/**
 * What a section coordinator or leader sees after signing in: their sections
 * on the map, every usher in them, open places and people who can't make it,
 * for each session. A leader sees all of this for each coordinator under them.
 */
export default function TeamHome() {
  const teamUser = useStore((s) => s.teamUser)
  const members = useStore((s) => s.members)
  const events = useStore((s) => s.events)
  const activeEventId = useStore((s) => s.activeEventId)
  const teamLogout = useStore((s) => s.teamLogout)
  const navigate = useNavigate()
  const me = members.find((m) => m.id === teamUser?.memberId)
  const active = events.find((e) => e.id === activeEventId) ?? events[0]
  const sessions = useMemo(() => (active ? sessionsOf(events, active) : []), [events, active])
  const [picked, setEventId] = useState('')
  const eventId = picked || activeEventId
  const [loadFailed, setLoadFailed] = useState(false)
  const noSession = useStore((s) => s.teamNoSession)
  useEffect(() => {
    if (LIVE && tokens.get('team')) loadTeam(picked || undefined).catch((e: ApiError) => { if (e.status !== 404) setLoadFailed(true) })
  }, [picked])
  const data = useEventData(eventId)
  const memberMap = useMemberMap()
  const scope = useMemo(() => (me ? teamScope(me, members) : { coordinators: [], zoneNames: new Set<string>() }), [me, members])

  const myLeaders = useMemo(() => {
    if (!me || me.role !== 'coordinator') return []
    const direct = leadersForMember(me, members)
    if (direct.length) return direct
    const seen = new Set<string>()
    const out: Member[] = []
    for (const zName of me.coordinates ?? []) {
      for (const l of leadersForZone(members, zName)) {
        if (!seen.has(l.id)) {
          seen.add(l.id)
          out.push(l)
        }
      }
    }
    return out
  }, [me, members])

  const coordZoneNames = useMemo(() => {
    const names = new Set<string>(me?.coordinates ?? [])
    if (LIVE && me?.role === 'coordinator') {
      data.zones.forEach((z) => names.add(z.name))
    }
    return names
  }, [me, data.zones])

  if (LIVE && tokens.get('team') && !me && !loadFailed) return <div role="status" className="grid min-h-[100dvh] place-items-center bg-canvas text-sm text-ink-500">Loading your team…</div>
  if (!me || (me.role !== 'coordinator' && me.role !== 'leader')) return <Navigate to="/team/login" replace />
  const event = data.event

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-tga-black text-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="Home"><Logo light compact /></Link>
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 text-right">
              <div className="truncate text-sm font-medium">{fullName(me)}</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tga-gold">{me.role === 'leader' ? 'Leader' : 'Section coordinator'}</div>
            </div>
            <Button size="icon-sm" variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={() => { teamLogout(); navigate('/team/login') }} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 pb-12 pt-6 sm:px-6">
        <div>
          <p className="text-sm text-ink-500">{event?.name}</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.02em] text-ink-900 sm:text-[30px]">
            {me.role === 'leader' ? `${scope.coordinators.length} coordinators, ${scope.zoneNames.size} zones` : zoneSummary([...coordZoneNames])}
          </h1>
          {myLeaders.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-600">
              <span className="inline-flex items-center gap-1 font-medium text-ink-500">
                <Crown className="h-3.5 w-3.5 text-wine-600" />
                {myLeaders.length > 1 ? 'Your leaders:' : 'Your leader:'}
              </span>
              {myLeaders.map((leader) => (
                <span key={leader.id} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-ink-900 ring-1 ring-line">
                  <span>{fullName(leader)}</span>
                  {leader.phone && (
                    <>
                      <span className="text-ink-300">·</span>
                      <a className="inline-flex items-center gap-1 text-wine-600 hover:underline tabular" href={telHref(leader.phone)}>
                        <Phone className="h-3 w-3" />
                        {formatPhone(leader.phone)}
                      </a>
                    </>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {sessions.length > 1 && (
          <nav aria-label="Sessions" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex gap-2">
              {sessions.map((e) => {
                const on = e.id === eventId
                return (
                  <li key={e.id} className="shrink-0">
                    <button onClick={() => setEventId(e.id)} aria-pressed={on} className={cn('flex w-[104px] flex-col items-start rounded-xl px-3 py-2 text-left ring-1', on ? 'bg-ink-950 text-white ring-ink-950' : 'bg-white text-ink-800 ring-line')}>
                      <span className={cn('text-[11px] font-semibold uppercase tracking-[0.08em]', on ? 'text-tga-gold' : 'text-ink-500')}>{formatDate(e.date, { weekday: 'short', day: 'numeric' })}</span>
                      <span className="text-sm font-semibold">{e.session === 'evening' ? 'Evening' : 'Morning'}</span>
                      <span className={cn('text-[11px]', on ? 'text-white/60' : 'text-ink-500')}>{e.rosterStatus === 'published' ? `Report ${formatTime(e.reportingTime)}` : 'Draft'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}

        {event && (
          <p className="text-sm text-ink-600">
            <span className="font-medium text-ink-900">{sessionLine(event) || formatDate(event.date)}</span> · {formatDate(event.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ushers report by {formatTime(event.reportingTime)}{event.startTime && `, service at ${formatTime(event.startTime)}`}
            {event.rosterStatus !== 'published' && <span className="text-warn-600"> · This roster is still a draft, so ushers can’t see it yet.</span>}
          </p>
        )}

        {LIVE && noSession ? (
          <p className="surface p-6 text-sm text-ink-500">No current session available. The admin team will set one up.</p>
        ) : me.role === 'leader' ? (
          <LeaderView data={data} coordinators={scope.coordinators} memberMap={memberMap} />
        ) : (
          <CoordinatorView data={data} zoneNames={coordZoneNames} memberMap={memberMap} />
        )}
      </main>
    </div>
  )
}

function Stats({ rosters }: { rosters: ZoneRoster[] }) {
  const assigned = rosters.reduce((n, r) => n + r.assigned, 0)
  const required = rosters.reduce((n, r) => n + r.required, 0)
  const confirmed = rosters.reduce((n, r) => n + r.confirmed, 0)
  const away = rosters.reduce((n, r) => n + r.away, 0)
  const items: [string, string, string?][] = [
    ['Ushers in place', `${assigned}`, `of ${required} needed (${rosters.length} section${rosters.length === 1 ? '' : 's'})`],
    ['Confirmed', `${confirmed}`, `${Math.max(0, assigned - confirmed)} not yet`],
    ['Open places', `${Math.max(0, required - assigned)}`],
    ['Can’t make it', `${away}`],
  ]
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4 [&>*]:bg-white">
      {items.map(([k, v, h]) => (
        <div key={k} className="px-4 py-3">
          <div className="text-xs text-ink-500">{k}</div>
          <div className={cn('mt-0.5 text-xl font-semibold tabular', k === 'Can’t make it' && v !== '0' ? 'text-bad-600' : 'text-ink-900')}>{v}</div>
          {h && <div className="text-[11px] text-ink-400">{h}</div>}
        </div>
      ))}
    </div>
  )
}

function TeamMap({ data, rosters, memberMap, onSelect }: { data: EventData; rosters: ZoneRoster[]; memberMap: Map<string, Member>; onSelect?: (zoneId: string) => void }) {
  const zones = rosters.map((r) => r.zone)
  const ids = zones.map((z) => z.id)
  const idSet = new Set(ids)
  const info = Object.fromEntries(
    rosters.map((r) => {
      const coverage = r.required ? Math.min(100, Math.round((r.assigned / r.required) * 100)) : r.assigned ? 100 : 0
      return [
        r.zone.id,
        {
          assigned: r.assigned,
          required: r.required,
          coverage,
          leaders: r.leaders.map(fullName),
          coordinators: r.coordinators.map(fullName),
        },
      ]
    }),
  )
  const positions = positionsOf(data).filter((p) => idSet.has(p.zoneId))
  const occupants = spotOccupants(data, memberMap, ids)
  const uncovered = Object.fromEntries(Object.entries(uncoveredSpots(data, memberMap)).filter(([pid]) => positions.some((p) => p.id === pid)))
  return (
    <section className="surface p-4 sm:p-5" aria-label="Your zones on the floor plan">
      <VenueMap zones={zones} mode="coverage" info={info} positions={positions} occupants={occupants} uncovered={uncovered} onSelect={onSelect} />
    </section>
  )
}

function CoordinatorView({ data, zoneNames, memberMap }: { data: EventData; zoneNames: Set<string>; memberMap: Map<string, Member> }) {
  const rosters = useZoneRosters(data, zoneNames, memberMap)
  const [focus, setFocus] = useState<string | null>(null)
  const jump = (zoneId: string) => {
    setFocus(zoneId)
    document.getElementById(`zr-${zoneId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  if (zoneNames.size === 0) return <p className="surface p-6 text-sm text-ink-500">No zones have been given to you yet. The admin team sets this on the Team page.</p>
  return (
    <>
      <Stats rosters={rosters} />
      {rosters.length > 0 && (
        <section className="surface p-4" aria-label="All your sections">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Your sections ({rosters.length})</h2>
            <span className="text-xs text-ink-400">Tap a section to jump to its details</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {rosters.map((r) => {
              const active = focus === r.zone.id
              return (
                <button
                  key={r.zone.id}
                  onClick={() => jump(r.zone.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-left text-xs ring-1 transition-colors',
                    active ? 'bg-ink-950 text-white ring-ink-950' : 'bg-paper/70 text-ink-800 ring-line hover:bg-white hover:ring-line-strong',
                  )}
                >
                  <span className="font-semibold">{r.zone.name}</span>
                  <span className={cn('tabular', active ? 'text-tga-gold' : 'text-ink-500')}>{r.assigned}/{r.required}</span>
                  {r.leaders.length > 0 && (
                    <span className={cn('hidden items-center gap-1 sm:inline-flex', active ? 'text-white/75' : 'text-wine-700')}>
                      · <Crown className="h-3 w-3" /> {r.leaders.map((l) => l.firstName).join(', ')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      )}
      <TeamMap data={data} rosters={rosters} memberMap={memberMap} onSelect={jump} />
      <Absences data={data} members={memberMap} zoneNames={zoneNames} limit={20} />
      <div className="grid gap-4 md:grid-cols-2">
        {rosters.map((r) => <ZoneRosterCard key={r.zone.id} id={`zr-${r.zone.id}`} r={r} highlight={focus === r.zone.id} />)}
      </div>
    </>
  )
}

function LeaderView({ data, coordinators, memberMap }: { data: EventData; coordinators: Member[]; memberMap: Map<string, Member> }) {
  const all = useMemo(() => new Set(coordinators.flatMap((c) => c.coordinates ?? [])), [coordinators])
  const allRosters = useZoneRosters(data, all, memberMap)
  const [open, setOpen] = useState<string | null>(null)
  if (coordinators.length === 0) return <p className="surface p-6 text-sm text-ink-500">No coordinators report to you yet. The admin team sets this on the Team page.</p>
  return (
    <>
      <Stats rosters={allRosters} />
      <TeamMap data={data} rosters={allRosters} memberMap={memberMap} onSelect={(zoneId) => {
        const name = allRosters.find((r) => r.zone.id === zoneId)?.zone.name ?? data.zoneById.get(zoneId)?.name
        const c = coordinators.find((x) => name && x.coordinates?.includes(name))
        if (c) { setOpen(c.id); setTimeout(() => document.getElementById(`co-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60) }
      }} />
      <Absences data={data} members={memberMap} zoneNames={all} limit={12} />
      <section aria-labelledby="co-h">
        <h2 id="co-h" className="mb-3 flex items-center gap-2 text-[17px] font-semibold tracking-tight text-ink-900"><Users className="h-4 w-4 text-wine-500" /> Your coordinators</h2>
        <ul className="space-y-3">
          {coordinators.map((c) => <CoordinatorRow key={c.id} c={c} data={data} memberMap={memberMap} open={open === c.id} onToggle={() => setOpen((o) => (o === c.id ? null : c.id))} />)}
        </ul>
      </section>
    </>
  )
}

function CoordinatorRow({ c, data, memberMap, open, onToggle }: { c: Member; data: EventData; memberMap: Map<string, Member>; open: boolean; onToggle: () => void }) {
  const names = useMemo(() => new Set(c.coordinates ?? []), [c.coordinates])
  const rosters = useZoneRosters(data, names, memberMap)
  const assigned = rosters.reduce((n, r) => n + r.assigned, 0)
  const required = rosters.reduce((n, r) => n + r.required, 0)
  const away = rosters.reduce((n, r) => n + r.away, 0)
  const cLeaders = useMemo(() => leadersForMember(c, [...memberMap.values()]), [c, memberMap])
  return (
    <li id={`co-${c.id}`} className="surface overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar first={c.firstName} last={c.lastName} size="sm" />
        <button onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <div className="truncate font-medium text-ink-900">{fullName(c)}</div>
          <div className="truncate text-xs text-ink-500">
            {zoneSummary(c.coordinates)}
            {cLeaders.length > 0 && ` · Leader${cLeaders.length > 1 ? 's' : ''}: ${cLeaders.map(fullName).join(', ')}`}
          </div>
        </button>
        <div className="hidden shrink-0 text-right text-xs sm:block">
          <div className="font-semibold text-ink-900 tabular">{assigned}/{required}</div>
          {away > 0 ? <div className="inline-flex items-center gap-1 text-bad-600"><CalendarX2 className="h-3 w-3" />{away} can’t make it</div> : <div className="text-ink-400">in place</div>}
        </div>
        <a href={telHref(c.phone)} aria-label={`Call ${fullName(c)}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 ring-line hover:ring-line-strong"><Phone className="h-3.5 w-3.5 text-wine-500" /></a>
        <button onClick={onToggle} aria-label={open ? 'Hide sections' : 'Show sections'} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-paper"><ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} /></button>
      </div>
      {open && (
        <div className="grid gap-3 border-t border-line bg-paper p-3 md:grid-cols-2">
          {rosters.map((r) => <ZoneRosterCard key={r.zone.id} r={r} />)}
        </div>
      )}
    </li>
  )
}
