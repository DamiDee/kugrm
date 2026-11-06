import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Clock3, LayoutGrid, MapPin, Pencil, Send, Shirt, Target } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { positionsOf, spotOccupants, useEventData, useMemberMap } from '@/lib/selectors'
import { formatDate, formatTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState, MetricCard, ProgressBar } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { EventForm } from '@/components/admin/EventForm'
import { PublishDialog } from '@/components/admin/PublishFlow'
import { Notice } from '@/components/public/AssignmentParts'
import { VenueMap } from '@/components/venue/VenueMap'

export default function EventDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const data = useEventData(id)
  const memberMap = useMemberMap()
  const activeEventId = useStore((s) => s.activeEventId)
  const setActive = useStore((s) => s.setActiveEvent)
  const [edit, setEdit] = useState(false)
  const [publish, setPublish] = useState(false)
  const { event, stats, zoneStats } = data
  if (!event) return <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Event not found" description="It may have been deleted." action={<Button onClick={() => navigate('/admin/events')}>Back to events</Button>} />
  const info = Object.fromEntries(zoneStats.map((z) => [z.zone.id, { assigned: z.assigned, required: z.required, coverage: z.coverage }]))
  const isActive = activeEventId === event.id
  const goWork = (path: string) => { setActive(event.id); navigate(path) }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/admin/events" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800"><ArrowLeft className="h-4 w-4" /> Events</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-ink-500">{event.code}</span><StatusBadge status={event.status} /><StatusBadge status={event.rosterStatus === 'published' ? 'published' : 'unpublished'} /></div>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.025em] text-ink-900">{event.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-500">
              <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{formatDate(event.date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{event.venue}</span>
              <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4" />Report {formatTime(event.reportingTime)}{event.briefingTime && ` · Briefing ${formatTime(event.briefingTime)}`}</span>
              {event.dressCode && <span className="flex items-center gap-1.5"><Shirt className="h-4 w-4" />{event.dressCode}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isActive && <Button variant="secondary" onClick={() => { setActive(event.id); toast.success(`Now working on ${event.code}.`) }}><Target className="h-4 w-4" /> Work on this event</Button>}
            <Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Edit</Button>
            <Button variant={event.rosterStatus === 'published' ? 'secondary' : 'accent'} onClick={() => setPublish(true)}><Send className="h-4 w-4" /> {event.rosterStatus === 'published' ? 'Unpublish roster' : 'Publish Roster'}</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4 [&>*]:bg-white">
        <MetricCard label="Assigned" value={stats.assigned} hint={`${stats.confirmed.toLocaleString()} confirmed`} />
        <MetricCard label="Unassigned" value={stats.unassigned} hint="members" />
        <MetricCard label="Positions" value={stats.positions} hint={`${stats.zones} zones`} />
        <MetricCard label="Coverage" value={stats.coverage} decimals={1} suffix="%" hint="of all members" />
      </div>

      {event.instructions && <Notice text={event.instructions} />}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <section className="surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Venue map</h2>
            <Button size="sm" variant="ghost" onClick={() => goWork('/admin/assignments?view=map')}>Open full map</Button>
          </div>
          <VenueMap compact zones={data.zones} mode="coverage" info={info} positions={positionsOf(data)} occupants={spotOccupants(data, memberMap)} onSelect={(z) => goWork(`/admin/assignments?view=map&zone=${z}`)} />
        </section>
        <section className="surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Zones</h2>
            <Button size="sm" variant="ghost" onClick={() => goWork('/admin/assignments?view=board')}><LayoutGrid className="h-3.5 w-3.5" /> Board</Button>
          </div>
          <ul className="scrollbar-thin max-h-[440px] space-y-3 overflow-y-auto pr-1">
            {zoneStats.map((z) => (
              <li key={z.zone.id}>
                <div className="mb-1 flex justify-between text-sm"><span className="text-ink-800">{z.zone.name}</span><span className="text-ink-500 tabular">{z.assigned}/{z.required}</span></div>
                <ProgressBar value={z.coverage} tone={z.coverage >= 95 ? 'ok' : z.coverage >= 85 ? 'gold' : 'wine'} />
              </li>
            ))}
          </ul>
        </section>
      </div>
      <EventForm open={edit} event={event} onClose={() => setEdit(false)} />
      <PublishDialog eventId={event.id} open={publish} onClose={() => setPublish(false)} />
    </div>
  )
}
