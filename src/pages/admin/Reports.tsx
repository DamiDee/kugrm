import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, FileSpreadsheet, FileText, Table2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useEventData } from '@/lib/selectors'
import { exportRoster, type ExportFormat, type ExportKind } from '@/lib/exporters'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PageHeader, ProgressBar, Segmented, Select } from '@/components/ui/misc'

const EXPORTS: { kind: ExportKind; title: string; desc: string }[] = [
  { kind: 'full', title: 'Full roster', desc: 'Every assignment, ordered by zone and position.' },
  { kind: 'aisle', title: 'Aisle roster', desc: 'One zone’s team, for aisle leads to print.' },
  { kind: 'unassigned', title: 'Unassigned members', desc: 'Active members without a position.' },
  { kind: 'event', title: 'Event roster', desc: 'Full roster including team/unit.' },
  { kind: 'contacts', title: 'Contact list', desc: 'Names, phones and emails of all members.' },
]

export default function Reports() {
  const activeEventId = useStore((s) => s.activeEventId)
  const members = useStore((s) => s.members)
  const data = useEventData(activeEventId)
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [zone, setZone] = useState(data.zones[0]?.id ?? '')

  const byUnit = useMemo(() => {
    const m = new Map<string, { total: number; assigned: number }>()
    members.filter((x) => x.status === 'active').forEach((x) => {
      const u = x.unit ?? 'No unit'
      const r = m.get(u) ?? { total: 0, assigned: 0 }
      r.total++
      if (data.byMember.has(x.id)) r.assigned++
      m.set(u, r)
    })
    return [...m.entries()].sort()
  }, [members, data.byMember])

  const gender = useMemo(() => {
    let f = 0, mm = 0
    data.assignments.forEach((a) => { const g = members.find((x) => x.id === a.memberId)?.gender; if (g === 'Female') f++; else if (g === 'Male') mm++ })
    return { f, m: mm }
  }, [data.assignments, members])

  const statusSplit = { confirmed: data.stats.confirmed, assigned: data.stats.assigned - data.stats.confirmed }
  const total = Math.max(1, data.stats.assigned)

  return (
    <div className="space-y-8">
      <PageHeader title="Reports" description={`Roster health and exports for ${data.event?.code}.`} />

      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-ink-900">Export</h2><p className="text-sm text-ink-500">Download roster information for printing or sharing.</p></div>
          <Segmented id="fmt" value={format} onChange={setFormat} options={[{ value: 'csv', label: 'CSV', icon: <Table2 className="h-3.5 w-3.5" /> }, { value: 'excel', label: 'Excel', icon: <FileSpreadsheet className="h-3.5 w-3.5" /> }, { value: 'pdf', label: 'PDF', icon: <FileText className="h-3.5 w-3.5" /> }]} />
        </div>
        <ul className="divide-y divide-line">
          {EXPORTS.map((x) => (
            <li key={x.kind} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex-1"><div className="font-medium text-ink-900">{x.title}</div><div className="text-sm text-ink-500">{x.desc}</div></div>
              {x.kind === 'aisle' && <Select value={zone} onChange={setZone} label="Zone" className="sm:w-48">{data.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</Select>}
              <Button variant="secondary" onClick={() => exportRoster(x.kind, format, activeEventId, zone)}><Download className="h-4 w-4" /> Export {format === 'excel' ? 'Excel' : format.toUpperCase()}</Button>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="surface p-5">
          <h2 className="font-semibold text-ink-900">Confirmation</h2>
          <p className="text-sm text-ink-500">Ushers who confirmed attendance</p>
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-ink-900/[.06]">
            <motion.div className="bg-ok-500" initial={{ width: 0 }} animate={{ width: `${(statusSplit.confirmed / total) * 100}%` }} transition={{ duration: 0.8 }} />
            <motion.div className="bg-wine-400" initial={{ width: 0 }} animate={{ width: `${(statusSplit.assigned / total) * 100}%` }} transition={{ duration: 0.8, delay: 0.1 }} />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="flex items-center gap-2 text-ink-600"><span className="h-2 w-2 rounded-full bg-ok-500" />Confirmed</dt><dd className="font-medium tabular">{statusSplit.confirmed.toLocaleString()}</dd></div>
            <div className="flex justify-between"><dt className="flex items-center gap-2 text-ink-600"><span className="h-2 w-2 rounded-full bg-wine-400" />Awaiting confirmation</dt><dd className="font-medium tabular">{statusSplit.assigned.toLocaleString()}</dd></div>
          </dl>
        </section>
        <section className="surface p-5">
          <h2 className="font-semibold text-ink-900">By team / unit</h2>
          <p className="text-sm text-ink-500">Share of active members assigned</p>
          <ul className="mt-4 space-y-3">
            {byUnit.map(([u, r], i) => {
              const v = Math.round((r.assigned / Math.max(1, r.total)) * 100)
              return <li key={u}><div className="mb-1 flex justify-between text-sm"><span className="text-ink-800">{u}</span><span className="text-ink-500 tabular">{r.assigned}/{r.total}</span></div><ProgressBar value={v} tone="ink" delay={i * 0.04} /></li>
            })}
          </ul>
        </section>
        <section className="surface p-5">
          <h2 className="font-semibold text-ink-900">Gender balance</h2>
          <p className="text-sm text-ink-500">Among assigned ushers</p>
          <div className="mt-6 grid grid-cols-2 gap-4">
            {[['Female', gender.f, 'bg-wine-500'], ['Male', gender.m, 'bg-ink-800']].map(([k, v, c]) => (
              <div key={k as string}>
                <div className={cn('mb-3 h-1 w-8 rounded-full', c as string)} />
                <div className="text-2xl font-semibold tracking-tight text-ink-900 tabular">{Math.round(((v as number) / total) * 100)}%</div>
                <div className="text-sm text-ink-500">{k} · {(v as number).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="surface p-5">
        <h2 className="font-semibold text-ink-900">Zone staffing</h2>
        <p className="text-sm text-ink-500">Assigned against the headcount each zone needs</p>
        <div className="mt-5 grid gap-x-10 gap-y-3 md:grid-cols-2">
          {data.zoneStats.map((z, i) => (
            <div key={z.zone.id} className="grid grid-cols-[140px_1fr_64px] items-center gap-3 text-sm">
              <span className="truncate text-ink-800">{z.zone.name}</span>
              <ProgressBar value={z.coverage} tone={z.coverage >= 95 ? 'ok' : z.coverage >= 85 ? 'gold' : 'wine'} delay={i * 0.02} />
              <span className="text-right text-ink-500 tabular">{z.assigned}/{z.required}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
