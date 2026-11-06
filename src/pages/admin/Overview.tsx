import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Grid2x2, ListTree, Plus, Upload, UserMinus, Users, Activity as ActivityIcon, Send, MapPin, Clock3 } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { positionsOf, spotOccupants, useEventData, useMemberMap } from '@/lib/selectors'
import { useFirstLoad } from '@/lib/hooks'
import { cn, formatDate, formatTime, greeting, timeAgo } from '@/lib/utils'
import { AnimatedNumber, EmptyState, MetricCard, ProgressBar } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EventSelector } from '@/components/admin/EventSelector'
import { AssignDialog } from '@/components/admin/AssignDialog'
import { VenueMap } from '@/components/venue/VenueMap'

const activityIcon = { assign: ClipboardList, event: CalendarDays, import: Upload, publish: Send, member: Users, position: ListTree }

export default function Overview() {
  const admin = useStore((s) => s.admin)
  const activeEventId = useStore((s) => s.activeEventId)
  const activity = useStore((s) => s.activity)
  const data = useEventData(activeEventId)
  const memberMap = useMemberMap()
  const { event, stats, zoneStats } = data
  const loading = useFirstLoad('overview')
  const navigate = useNavigate()
  const [assignOpen, setAssignOpen] = useState(false)

  if (!event) return <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="No events yet" description="Create your first event to begin building a roster." action={<Button variant="primary" onClick={() => navigate('/admin/events?new=1')}><Plus className="h-4 w-4" /> Create Event</Button>} />

  const info = Object.fromEntries(zoneStats.map((z) => [z.zone.id, { assigned: z.assigned, required: z.required, coverage: z.coverage }]))
  const aisles = zoneStats.filter((z) => z.zone.kind === 'aisle')
  const areas = zoneStats.filter((z) => z.zone.kind !== 'aisle').sort((a, b) => a.coverage - b.coverage)

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-ink-900">{greeting()}, {admin?.name ?? 'Admin'}</h1>
          <p className="mt-1 text-[14.5px] text-ink-500">Here’s what is happening with your current roster.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EventSelector className="md:hidden" />
          <Button variant="secondary" onClick={() => navigate('/admin/import')}><Upload className="h-4 w-4" /> Import</Button>
          <Button variant="primary" onClick={() => setAssignOpen(true)}><Plus className="h-4 w-4" /> Assign member</Button>
        </div>
      </div>

      {/* event strip */}
      <div className="flex flex-col gap-3 rounded-2xl bg-ink-950 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="hidden h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-white/10 leading-none sm:flex">
            <span className="text-[10px] uppercase tracking-wider text-gold-300">{formatDate(event.date, { month: 'short' })}</span>
            <span className="mt-0.5 text-base font-semibold">{formatDate(event.date, { day: 'numeric' })}</span>
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium">{event.name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-white/55">
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{event.venue}</span>
              <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Report {formatTime(event.reportingTime)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={event.status} className="bg-white/10 text-white ring-white/10" />
          <StatusBadge status={event.rosterStatus === 'published' ? 'published' : 'unpublished'} className={event.rosterStatus === 'published' ? 'bg-ok-500/20 text-[#9BE0BC] ring-ok-500/30' : 'bg-warn-500/20 text-[#F5CF8E] ring-warn-500/30'} />
          <Link to={`/admin/events/${event.id}`} className="ml-1 rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Open event"><ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-white px-5 py-4"><Skeleton className="h-3 w-20" /><Skeleton className="mt-3 h-6 w-16" /></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3 xl:grid-cols-6 [&>*]:bg-white">
          <MetricCard label="Total Ushers" value={stats.totalMembers} icon={<Users className="h-4 w-4" />} hint="In the department" />
          <MetricCard label="Assigned" value={stats.assigned} icon={<CheckCircle2 className="h-4 w-4" />} tone="ok" hint={`${stats.confirmed.toLocaleString()} confirmed`} />
          <MetricCard label="Unassigned" value={stats.unassigned} icon={<UserMinus className="h-4 w-4" />} tone="warn" hint={<Link to="/admin/members?filter=unassigned" className="text-wine-600 hover:underline">Review list</Link>} />
          <MetricCard label="Working Positions" value={stats.positions} icon={<ListTree className="h-4 w-4" />} hint={`${stats.required.toLocaleString()} ushers needed`} />
          <MetricCard label="Teams / Zones" value={stats.zones} icon={<Grid2x2 className="h-4 w-4" />} hint={`${aisles.length} aisles · ${zoneStats.filter((z) => z.zone.kind === 'section').length} sections`} />
          <MetricCard label="Coverage" value={stats.coverage} decimals={1} suffix="%" icon={<ActivityIcon className="h-4 w-4" />} tone="wine" hint="of all members" />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        {/* coverage */}
        <section className="surface p-6" aria-labelledby="cov-h">
          <div className="flex items-start justify-between">
            <div>
              <h2 id="cov-h" className="font-semibold text-ink-900">Roster coverage</h2>
              <p className="text-sm text-ink-500">Assigned members and staffing per aisle</p>
            </div>
            <Link to="/admin/assignments?view=board" className="text-sm font-medium text-wine-600 hover:text-wine-700">Open board</Link>
          </div>
          <div className="mt-6 grid gap-8 md:grid-cols-[180px_1fr]">
            <Donut value={stats.coverage} assigned={stats.assigned} remaining={stats.unassigned} />
            <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              {aisles.map((z, i) => (
                <li key={z.zone.id}>
                  <Link to={`/admin/assignments?view=board&zone=${z.zone.id}`} className="group block">
                    <div className="mb-1.5 flex items-baseline justify-between text-sm">
                      <span className="font-medium text-ink-800 group-hover:text-wine-600">{z.zone.name}</span>
                      <span className="tabular text-ink-500">{z.coverage}%</span>
                    </div>
                    <ProgressBar value={z.coverage} delay={i * 0.03} tone={z.coverage >= 95 ? 'ok' : z.coverage >= 85 ? 'gold' : 'wine'} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-7 border-t border-line pt-5">
            <div className="eyebrow mb-3">Sections and doors needing ushers</div>
            <div className="flex flex-wrap gap-2">
              {areas.slice(0, 6).map((z) => (
                <Link key={z.zone.id} to={`/admin/assignments?view=board&zone=${z.zone.id}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-[13px] hover:border-line-strong">
                  <span className={cn('h-1.5 w-1.5 rounded-full', z.coverage >= 95 ? 'bg-ok-500' : z.coverage >= 85 ? 'bg-gold-500' : 'bg-wine-500')} />
                  {z.zone.name}
                  <span className="text-ink-500 tabular">{z.assigned}/{z.required}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* map */}
        <section className="surface p-6" aria-labelledby="map-h">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 id="map-h" className="font-semibold text-ink-900">Venue map</h2>
              <p className="text-sm text-ink-500">Staffing level by zone</p>
            </div>
            <Link to="/admin/assignments?view=map" className="text-sm font-medium text-wine-600 hover:text-wine-700">Full map</Link>
          </div>
          <VenueMap compact zones={data.zones} mode="coverage" info={info} positions={positionsOf(data)} occupants={spotOccupants(data, memberMap)} onSelect={(id) => navigate(`/admin/assignments?view=map&zone=${id}`)} />
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className="surface" aria-labelledby="act-h">
          <div className="flex items-center justify-between px-6 pb-2 pt-5">
            <h2 id="act-h" className="font-semibold text-ink-900">Recent activity</h2>
          </div>
          {activity.length === 0 ? (
            <EmptyState icon={<ActivityIcon className="h-5 w-5" />} title="No activity yet" description="Changes made by administrators will appear here." />
          ) : (
            <ol className="px-3 pb-3">
              {activity.slice(0, 7).map((a, i) => {
                const Icon = activityIcon[a.kind]
                return (
                  <motion.li key={a.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-paper">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper text-ink-500 ring-1 ring-line"><Icon className="h-3.5 w-3.5" /></span>
                    <p className="flex-1 text-sm text-ink-700"><span className="font-medium text-ink-900">{a.actor}</span> {a.text}</p>
                    <time className="shrink-0 pt-0.5 text-xs text-ink-400" dateTime={a.at}>{timeAgo(a.at)}</time>
                  </motion.li>
                )
              })}
            </ol>
          )}
        </section>
        <UpcomingEvents />
      </div>
      <AssignDialog open={assignOpen} onClose={() => setAssignOpen(false)} />
    </div>
  )
}

function Donut({ value, assigned, remaining }: { value: number; assigned: number; remaining: number }) {
  const r = 62
  const c = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[164px] w-[164px]">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="80" cy="80" r={r} fill="none" stroke="#EFEBE4" strokeWidth="14" />
          <motion.circle cx="80" cy="80" r={r} fill="none" stroke="#7C2541" strokeWidth="14" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[28px] font-semibold tracking-[-0.03em] text-ink-900"><AnimatedNumber value={value} decimals={1} suffix="%" /></span>
          <span className="text-xs text-ink-500">assigned</span>
        </div>
      </div>
      <dl className="mt-4 flex gap-5 text-xs">
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-wine-600" /><dt className="text-ink-500">Assigned</dt><dd className="font-semibold text-ink-900 tabular">{assigned.toLocaleString()}</dd></div>
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#E3DDD3]" /><dt className="text-ink-500">Remaining</dt><dd className="font-semibold text-ink-900 tabular">{remaining.toLocaleString()}</dd></div>
      </dl>
    </div>
  )
}

function UpcomingEvents() {
  const events = useStore((s) => s.events)
  const list = [...events].filter((e) => e.status !== 'archived' && e.status !== 'completed').sort((a, b) => a.date.localeCompare(b.date))
  return (
    <section className="surface" aria-labelledby="up-h">
      <div className="flex items-center justify-between px-6 pb-2 pt-5">
        <h2 id="up-h" className="font-semibold text-ink-900">Upcoming events</h2>
        <Link to="/admin/events" className="text-sm font-medium text-wine-600 hover:text-wine-700">All events</Link>
      </div>
      <ul className="px-3 pb-3">
        {list.map((e) => (
          <li key={e.id}>
            <Link to={`/admin/events/${e.id}`} className="flex items-center gap-4 rounded-xl px-3 py-3 hover:bg-paper">
              <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-white leading-none">
                <span className="text-[10px] uppercase tracking-wider text-wine-600">{formatDate(e.date, { month: 'short' })}</span>
                <span className="mt-0.5 text-[15px] font-semibold text-ink-900">{formatDate(e.date, { day: 'numeric' })}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink-900">{e.name}</div>
                <div className="text-xs text-ink-500">Report {formatTime(e.reportingTime)}</div>
              </div>
              <StatusBadge status={e.rosterStatus === 'published' ? 'published' : 'unpublished'} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
