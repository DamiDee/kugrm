import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Archive, CalendarDays, Copy, Eye, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { computeEventData } from '@/lib/selectors'
import { useFirstLoad } from '@/lib/hooks'
import { cn, formatShortDate, formatTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState, PageHeader, Popover, Segmented } from '@/components/ui/misc'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { EventForm } from '@/components/admin/EventForm'
import type { MinistryEvent } from '@/data/types'

export default function Events() {
  const s = useStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const loading = useFirstLoad('events')
  const [tab, setTab] = useState<'current' | 'completed' | 'archived'>('current')
  const [form, setForm] = useState<{ open: boolean; event?: MinistryEvent }>({ open: params.get('new') === '1' })
  const [confirm, setConfirm] = useState<{ kind: 'archive' | 'delete'; event: MinistryEvent } | null>(null)
  useEffect(() => { if (params.get('new') === '1') { setForm({ open: true }); setParams({}, { replace: true }) } }, [params, setParams])

  const counts = useMemo(() => new Map(s.events.map((e) => [e.id, computeEventData(e.id, s).stats.assigned])), [s.events, s.assignments, s.members]) // eslint-disable-line react-hooks/exhaustive-deps
  const list = s.events
    .filter((e) => (tab === 'current' ? e.status === 'active' || e.status === 'draft' : e.status === tab))
    .sort((a, b) => (tab === 'current' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)))

  const actions = (e: MinistryEvent) => (
    <Popover
      className="w-48 p-1"
      trigger={({ toggle }) => <Button size="icon-sm" variant="ghost" onClick={(ev) => { ev.stopPropagation(); toggle() }} aria-label={`Actions for ${e.code}`}><MoreHorizontal className="h-4 w-4" /></Button>}
    >
      {(close) => (
        <div className="text-sm" onClick={(ev) => ev.stopPropagation()}>
          {[
            { label: 'View', icon: Eye, run: () => navigate(`/admin/events/${e.id}`) },
            { label: 'Edit', icon: Pencil, run: () => setForm({ open: true, event: e }) },
            { label: 'Duplicate', icon: Copy, run: () => { s.duplicateEvent(e.id); toast.success('Event duplicated.', 'The copy is a draft with the same positions.') } },
            ...(e.status !== 'archived' ? [{ label: 'Archive', icon: Archive, run: () => setConfirm({ kind: 'archive', event: e }) }] : []),
          ].map((a) => (
            <button key={a.label} onClick={() => { close(); a.run() }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-ink-700 hover:bg-paper"><a.icon className="h-4 w-4 text-ink-400" />{a.label}</button>
          ))}
          <div className="my-1 border-t border-line" />
          <button onClick={() => { close(); setConfirm({ kind: 'delete', event: e }) }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-bad-500 hover:bg-bad-50"><Trash2 className="h-4 w-4" />Delete</button>
        </div>
      )}
    </Popover>
  )

  return (
    <div>
      <PageHeader title="Events" description="Every ministry event has its own roster, zones and publication state." actions={<Button variant="primary" onClick={() => setForm({ open: true })}><Plus className="h-4 w-4" /> Create Event</Button>} />
      <div className="mb-4"><Segmented id="etab" value={tab} onChange={setTab} options={[{ value: 'current', label: 'Upcoming & active' }, { value: 'completed', label: 'Completed' }, { value: 'archived', label: 'Archived' }]} /></div>
      <div className="surface overflow-hidden">
        {loading ? <TableSkeleton rows={4} /> : list.length === 0 ? (
          <EmptyState icon={<CalendarDays className="h-5 w-5" />} title={tab === 'current' ? 'No events yet' : `No ${tab} events`} description={tab === 'current' ? 'Create your first event to begin building a roster.' : 'Events you complete or archive will appear here.'} action={tab === 'current' ? <Button variant="primary" onClick={() => setForm({ open: true })}><Plus className="h-4 w-4" /> Create Event</Button> : undefined} />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((e) => (
              <li key={e.id} onClick={() => navigate(`/admin/events/${e.id}`)} className={cn('grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-paper md:grid-cols-[auto_1.6fr_1fr_.8fr_.9fr_auto]', e.id === s.activeEventId && 'bg-wine-50/30')}>
                <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl border border-line bg-white leading-none">
                  <span className="text-[10px] uppercase tracking-wider text-wine-600">{new Date(e.date + 'T12:00').toLocaleDateString('en-GB', { month: 'short' })}</span>
                  <span className="mt-0.5 text-base font-semibold text-ink-900">{new Date(e.date + 'T12:00').getDate()}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink-900">{e.name}</span>
                    {e.id === s.activeEventId && <span className="hidden rounded-full bg-ink-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white sm:inline">Working on</span>}
                  </div>
                  <div className="mt-0.5 text-[13px] text-ink-500"><span className="font-mono text-xs">{e.code}</span> · {formatShortDate(e.date)} · Report {formatTime(e.reportingTime)}</div>
                </div>
                <div className="hidden truncate text-sm text-ink-600 md:block">{e.venue}</div>
                <div className="hidden text-sm md:block"><span className="font-semibold text-ink-900 tabular">{(counts.get(e.id) ?? 0).toLocaleString()}</span> <span className="text-ink-500">assigned</span></div>
                <div className="hidden flex-wrap gap-1.5 md:flex"><StatusBadge status={e.status} /><StatusBadge status={e.rosterStatus === 'published' ? 'published' : 'unpublished'} /></div>
                {actions(e)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <EventForm open={form.open} event={form.event} onClose={() => setForm({ open: false })} onCreated={(id) => navigate(`/admin/events/${id}`)} />
      <ConfirmDialog
        open={confirm?.kind === 'archive'} onClose={() => setConfirm(null)} tone="primary" title={`Archive ${confirm?.event.code}?`}
        description="Archived events are hidden from ushers and the event selector. You can still view them here." confirmLabel="Archive event"
        onConfirm={() => { confirm && s.archiveEvent(confirm.event.id); toast.success('Event archived.') }}
      />
      <ConfirmDialog
        open={confirm?.kind === 'delete'} onClose={() => setConfirm(null)} title={`Delete ${confirm?.event.code}?`}
        description="This permanently removes the event, its zones, positions and every assignment on its roster." confirmLabel="Delete event"
        onConfirm={() => { confirm && s.deleteEvent(confirm.event.id); toast.success('Event deleted.') }}
      />
    </div>
  )
}
