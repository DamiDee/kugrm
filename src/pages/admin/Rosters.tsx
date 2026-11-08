import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Download, Eye, EyeOff, LayoutGrid, Send } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { computeEventData } from '@/lib/selectors'
import { eventLabel, formatShortDate, formatTime, sessionLine, sessionOrder, timeAgo } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { PageHeader, ProgressBar } from '@/components/ui/misc'
import { PublishDialog } from '@/components/admin/PublishFlow'
import { exportRoster } from '@/lib/exporters'

export default function Rosters() {
  const s = useStore()
  const navigate = useNavigate()
  const [publishId, setPublishId] = useState<string | null>(null)
  const [copyTo, setCopyTo] = useState<string | null>(null)
  const rows = useMemo(
    () => s.events.filter((e) => e.status !== 'archived').sort((a, b) => sessionOrder(a).localeCompare(sessionOrder(b))).map((e) => ({ e, d: computeEventData(e.id, s) })),
    [s.events, s.assignments, s.members, s.zones, s.positions], // eslint-disable-line react-hooks/exhaustive-deps
  )
  return (
    <div>
      <PageHeader title="Rosters" description="Prepare rosters privately as drafts, then publish when ushers should see them." />
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map(({ e, d }) => {
          const fill = d.stats.required ? Math.min(100, Math.round((d.stats.assigned / d.stats.required) * 100)) : 0
          const published = e.rosterStatus === 'published'
          return (
            <section key={e.id} className="surface flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="font-mono text-xs text-ink-500">{e.code}</span><StatusBadge status={e.status} /></div>
                  <h2 className="mt-1.5 truncate text-[17px] font-semibold tracking-tight text-ink-900">{e.name}</h2>
                  <p className="text-sm text-ink-500">{formatShortDate(e.date)}{sessionLine(e) && ` · ${sessionLine(e)}`} · Report {formatTime(e.reportingTime)}</p>
                </div>
                <span className={published ? 'inline-flex items-center gap-1.5 rounded-full bg-ok-50 px-2.5 py-1 text-xs font-medium text-ok-600' : 'inline-flex items-center gap-1.5 rounded-full bg-ink-900/[.05] px-2.5 py-1 text-xs font-medium text-ink-600'}>
                  {published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}{published ? 'Visible to ushers' : 'Draft · hidden'}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-4 text-sm">
                <div><div className="text-ink-500">Assigned</div><div className="mt-0.5 text-lg font-semibold text-ink-900 tabular">{d.stats.assigned.toLocaleString()}</div></div>
                <div><div className="text-ink-500">Needed</div><div className="mt-0.5 text-lg font-semibold text-ink-900 tabular">{d.stats.required.toLocaleString()}</div></div>
                <div><div className="text-ink-500">Confirmed</div><div className="mt-0.5 text-lg font-semibold text-ink-900 tabular">{d.stats.confirmed.toLocaleString()}</div></div>
              </div>
              <div className="mt-4 flex items-center gap-3"><ProgressBar value={fill} tone={fill >= 95 ? 'ok' : fill >= 70 ? 'gold' : 'wine'} /><span className="text-xs text-ink-500 tabular">{fill}% staffed</span></div>
              <p className="mt-3 text-xs text-ink-400">{published && e.publishedAt ? `Published ${timeAgo(e.publishedAt)}` : 'Not published'}</p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <Button size="sm" variant={published ? 'secondary' : 'accent'} onClick={() => setPublishId(e.id)}><Send className="h-3.5 w-3.5" /> {published ? 'Unpublish' : 'Publish Roster'}</Button>
                <Button size="sm" variant="secondary" onClick={() => { s.setActiveEvent(e.id); navigate('/admin/assignments?view=board') }}><LayoutGrid className="h-3.5 w-3.5" /> Open board</Button>
                <Button size="sm" variant="ghost" onClick={() => setCopyTo(e.id)}><Copy className="h-3.5 w-3.5" /> Copy from…</Button>
                <Button size="sm" variant="ghost" onClick={() => exportRoster('full', 'csv', e.id)}><Download className="h-3.5 w-3.5" /> CSV</Button>
              </div>
            </section>
          )
        })}
      </div>
      {copyTo && <CopyRosterDialog toId={copyTo} onClose={() => setCopyTo(null)} />}
      {publishId && <PublishDialog eventId={publishId} open={!!publishId} onClose={() => setPublishId(null)} />}
    </div>
  )
}

/** Copy another session's roster into this one: same people, same places, as "assigned". */
function CopyRosterDialog({ toId, onClose }: { toId: string; onClose: () => void }) {
  const events = useStore((s) => s.events)
  const copyRoster = useStore((s) => s.copyRoster)
  const to = events.find((e) => e.id === toId)!
  const options = events.filter((e) => e.id !== toId && e.status !== 'archived').sort((a, b) => sessionOrder(a).localeCompare(sessionOrder(b)))
  const [from, setFrom] = useState(options.find((e) => e.series && e.series === to.series)?.id ?? options[0]?.id ?? '')
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Copy a roster into ${eventLabel(to)}`}
      description="Everyone on the other roster is placed in the same zone and position here. People already on this roster who are in the copy are moved to match; everyone else stays."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!from} onClick={() => { const n = copyRoster(from, toId); toast.success(`${n} assignments copied.`); onClose() }}>Copy roster</Button>
        </>
      }
    >
      <Select value={from} onChange={setFrom} label="Copy from" id="copy-from">
        {options.map((e) => <option key={e.id} value={e.id}>{eventLabel(e)} · {formatShortDate(e.date)}</option>)}
      </Select>
    </Modal>
  )
}
