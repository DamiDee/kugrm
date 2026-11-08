import { useMemo } from 'react'
import { CalendarX2, CheckCircle2, Crown, Phone } from 'lucide-react'
import type { Member, Position, Zone } from '@/data/types'
import type { EventData } from '@/lib/selectors'
import { cn, formatPhone, fullName, telHref } from '@/lib/utils'
import { DUTY_LABEL, dutyOf } from '@/data/duties'
import { zoneNote } from '@/data/venue'

/** "Sections 40–43, Aisle 5, Door X3" from a list of zone names. */
export function zoneSummary(names: string[] = []) {
  const secs = names.map((n) => n.match(/^Section (\d+)$/)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b)
  const rest = names.filter((n) => !/^Section \d+$/.test(n))
  const runs: string[] = []
  for (let i = 0; i < secs.length; ) {
    let j = i
    while (j + 1 < secs.length && secs[j + 1] === secs[j] + 1) j++
    runs.push(j > i ? `${secs[i]}–${secs[j]}` : `${secs[i]}`)
    i = j + 1
  }
  const parts = runs.length ? [`Section${secs.length > 1 ? 's' : ''} ${runs.join(', ')}`] : []
  return [...parts, ...rest].join(' · ') || 'No zones yet'
}

export interface ZoneRoster {
  zone: Zone
  rows: { position: Position; member?: Member; status?: string; isLead?: boolean; reason?: string; away?: Member }[]
  assigned: number
  required: number
  away: number
}

/** Everyone in each zone a coordinator oversees, with open places and people who can't make it. */
export function useZoneRosters(data: EventData, zoneNames: Set<string>, members: Map<string, Member>) {
  return useMemo<ZoneRoster[]>(() => {
    return data.zones.filter((z) => zoneNames.has(z.name)).map((zone) => {
      const positions = data.positionsByZone.get(zone.id) ?? []
      const working = data.byZone.get(zone.id) ?? []
      const away = data.unavailable.filter((a) => a.zoneId === zone.id)
      const rows: ZoneRoster['rows'] = []
      for (const p of positions) {
        const here = working.filter((a) => a.positionId === p.id)
        here.forEach((a) => rows.push({ position: p, member: members.get(a.memberId), status: a.status, isLead: a.isTeamLead }))
        const gone = away.filter((a) => a.positionId === p.id)
        gone.forEach((a) => rows.push({ position: p, away: members.get(a.memberId), status: 'unavailable', reason: a.unavailableReason }))
        const missing = Math.max(0, (p.required ?? 0) - here.length - (p.spot ? 0 : gone.length))
        if (p.spot ? here.length === 0 && gone.length === 0 : missing > 0) rows.push({ position: p })
      }
      const required = positions.reduce((n, p) => n + (p.required ?? 0), 0)
      return { zone, rows, assigned: working.length, required, away: away.length }
    })
  }, [data, zoneNames, members])
}

export function ZoneRosterCard({ r, highlight, id }: { r: ZoneRoster; highlight?: boolean; id?: string }) {
  const short = Math.max(0, r.required - r.assigned)
  return (
    <section id={id} className={cn('rounded-2xl border bg-white transition-shadow', highlight ? 'border-wine-400 shadow-float' : 'border-line')}>
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-bold uppercase tracking-[0.12em] text-ink-900">{r.zone.name}</h3>
          {zoneNote(r.zone) && <p className="truncate text-xs text-ink-500">{zoneNote(r.zone)}</p>}
        </div>
        <div className="shrink-0 text-right text-xs">
          <div className="font-semibold text-ink-900 tabular">{r.assigned}/{r.required}</div>
          <div className={cn(short ? 'text-wine-600' : 'text-ok-600')}>{short ? `${short} open` : 'Full'}</div>
        </div>
      </header>
      <ul className="divide-y divide-line">
        {r.rows.map((row, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 text-sm">
                {row.member ? (
                  <span className="truncate font-medium text-ink-900">{fullName(row.member)}</span>
                ) : row.away ? (
                  <span className="truncate font-medium text-ink-400 line-through">{fullName(row.away)}</span>
                ) : (
                  <span className="font-medium text-wine-600">Open</span>
                )}
                {row.isLead && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold-700"><Crown className="h-3 w-3" />Lead</span>}
              </div>
              <div className="truncate text-xs text-ink-500">
                {row.position.name} · {DUTY_LABEL[dutyOf(row.position)]}
                {row.status === 'unavailable' && <span className="text-bad-600"> · can’t make it{row.reason ? ` (${row.reason})` : ''}</span>}
              </div>
            </div>
            {row.member ? (
              <>
                {row.status === 'confirmed' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-ok-500" aria-label="Confirmed" /> : <span className="shrink-0 text-[11px] text-ink-400">Not confirmed</span>}
                <a href={telHref(row.member.phone)} aria-label={`Call ${fullName(row.member)}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium text-ink-700 ring-1 ring-line hover:ring-line-strong">
                  <Phone className="h-3.5 w-3.5 text-wine-500" /><span className="hidden sm:inline tabular">{formatPhone(row.member.phone)}</span><span className="sm:hidden">Call</span>
                </a>
              </>
            ) : row.away ? (
              <CalendarX2 className="h-4 w-4 shrink-0 text-bad-500" aria-label="Can’t make it" />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
