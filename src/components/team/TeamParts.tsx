import { useMemo } from 'react'
import { CalendarX2, CheckCircle2, Crown, Phone } from 'lucide-react'
import type { Member, Position, Zone, ZoneKind } from '@/data/types'
import { coordinatorsFor, leadersForZone, type EventData } from '@/lib/selectors'
import { cn, formatPhone, fullName, telHref } from '@/lib/utils'
import { DUTY_LABEL, dutyOf } from '@/data/duties'
import { SPOTS, hasSpots, sectionOfRef, zoneNote, zoneRef } from '@/data/venue'

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

export function inferZoneKind(name: string): ZoneKind {
  if (/^sec(?:tion)?\.?\s*\d+$/i.test(name.trim())) return 'section'
  if (/^aisle\s*\d+$/i.test(name.trim())) return 'aisle'
  if (/^(?:door\s*)?[DXM]\d\b/i.test(name.trim())) return 'door'
  return 'area'
}

export interface ZoneRoster {
  zone: Zone
  rows: { position: Position; member?: Member; status?: string; isLead?: boolean; reason?: string; away?: Member }[]
  assigned: number
  required: number
  confirmed: number
  away: number
  leaders: Member[]
  coordinators: Member[]
  lead?: Member
}

/** Everyone in each zone a coordinator oversees, with open places, people who can't make it, and attached leaders. */
export function useZoneRosters(data: EventData, zoneNames: Set<string>, members: Map<string, Member>) {
  return useMemo<ZoneRoster[]>(() => {
    const allMembers = [...members.values()]
    const existingByName = new Map(data.zones.map((z) => [z.name, z]))
    const zones: Zone[] = []
    for (const z of data.zones) {
      if (zoneNames.has(z.name)) zones.push(z)
    }
    let extraIdx = 0
    for (const name of zoneNames) {
      if (!existingByName.has(name)) {
        const ref = zoneRef({ name })
        const secNum = sectionOfRef(ref)
        zones.push({
          id: `virtual_${data.event?.id ?? 'ev'}_${ref ?? extraIdx}`,
          eventId: data.event?.id ?? '',
          name,
          kind: inferZoneKind(name),
          order: secNum ? 100 + secNum : 900 + extraIdx++,
          mapRef: ref,
        })
      }
    }
    zones.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, undefined, { numeric: true }))

    return zones.map((zone) => {
      let positions = data.positionsByZone.get(zone.id) ?? []
      const secNum = sectionOfRef(zoneRef(zone))
      if (positions.length === 0 && secNum && hasSpots(secNum)) {
        positions = SPOTS.map((sp, idx) => ({
          id: `${zone.id}_${sp.key}`,
          zoneId: zone.id,
          name: sp.name,
          order: idx + 1,
          required: 1,
          spot: sp.key,
          duty: 'seat' as const,
        }))
      }
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
      const confirmed = working.filter((a) => a.status === 'confirmed').length
      const leadAssign = working.find((a) => a.isTeamLead)
      const lead = leadAssign ? members.get(leadAssign.memberId) : undefined
      const leaders = leadersForZone(allMembers, zone.name)
      const coordinators = coordinatorsFor(allMembers, zone.name)
      return { zone, rows, assigned: working.length, required, confirmed, away: away.length, leaders, coordinators, lead }
    })
  }, [data, zoneNames, members])
}

export function ZoneRosterCard({ r, highlight, id }: { r: ZoneRoster; highlight?: boolean; id?: string }) {
  const short = Math.max(0, r.required - r.assigned)
  const note = zoneNote(r.zone)
  return (
    <section id={id} className={cn('rounded-2xl border bg-white transition-shadow', highlight ? 'border-wine-400 shadow-float' : 'border-line')}>
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-[13px] font-bold uppercase tracking-[0.12em] text-ink-900">{r.zone.name}</h3>
            {r.lead && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold-100/80 px-2 py-0.5 text-[11px] font-medium text-gold-700 ring-1 ring-gold-300/50">
                <Crown className="h-3 w-3 shrink-0" />
                <span className="break-words">Lead: {fullName(r.lead)}</span>
              </span>
            )}
          </div>
          {note && <p className="mt-0.5 break-words text-xs leading-relaxed text-ink-500">{note}</p>}
        </div>
        <div className="shrink-0 text-right text-xs">
          <div className="font-semibold text-ink-900 tabular">{r.assigned}/{r.required} ushers</div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {r.confirmed > 0 && <span className="text-ok-600 tabular">{r.confirmed} confirmed ·</span>}
            <span className={cn(short ? 'text-wine-600' : 'text-ok-600')}>{short ? `${short} open` : 'Full'}</span>
          </div>
        </div>
      </header>
      {(r.leaders.length > 0 || r.coordinators.length > 0) && (
        <div className="space-y-2 border-b border-line bg-paper/70 px-4 py-3 text-xs">
          {r.leaders.length > 0 && (
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-wine-700">
                <Crown className="h-3 w-3 shrink-0 text-wine-600" />
                <span>{r.leaders.length > 1 ? 'Section leaders' : 'Section leader'}</span>
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
                {r.leaders.map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-1.5 font-medium text-ink-900 ring-1 ring-line sm:inline-flex sm:rounded-full sm:py-1">
                    <span className="break-words leading-snug">{fullName(l)}</span>
                    {l.phone && (
                      <a href={telHref(l.phone)} className="inline-flex shrink-0 items-center gap-1 text-wine-600 hover:underline tabular" aria-label={`Call ${fullName(l)}`}>
                        <Phone className="h-3 w-3 shrink-0" />
                        <span>{formatPhone(l.phone)}</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {r.coordinators.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                {r.coordinators.length > 1 ? 'Coordinators' : 'Coordinator'}
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
                {r.coordinators.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-1.5 font-medium text-ink-900 ring-1 ring-line sm:inline-flex sm:rounded-full sm:py-1">
                    <span className="break-words leading-snug">{fullName(c)}</span>
                    {c.phone && (
                      <a href={telHref(c.phone)} className="inline-flex shrink-0 items-center gap-1 text-wine-600 hover:underline tabular" aria-label={`Call ${fullName(c)}`}>
                        <Phone className="h-3 w-3 shrink-0" />
                        <span>{formatPhone(c.phone)}</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <ul className="divide-y divide-line">
        {r.rows.length === 0 && (
          <li className="px-4 py-4 text-center text-xs text-ink-400">No positions configured for this section yet.</li>
        )}
        {r.rows.map((row, i) => (
          <li key={i} className="flex items-start justify-between gap-3 px-4 py-3 sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                {row.member ? (
                  <span className="break-words font-medium leading-snug text-ink-900">{fullName(row.member)}</span>
                ) : row.away ? (
                  <span className="break-words font-medium leading-snug text-ink-400 line-through">{fullName(row.away)}</span>
                ) : (
                  <span className="font-medium text-wine-600">Open</span>
                )}
                {row.isLead && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold-700"><Crown className="h-3 w-3 shrink-0" />Lead</span>}
              </div>
              <div className="mt-0.5 break-words text-xs leading-relaxed text-ink-500">
                {row.position.name} · {DUTY_LABEL[dutyOf(row.position)]}
                {row.status === 'unavailable' && <span className="text-bad-600"> · can’t make it{row.reason ? ` (${row.reason})` : ''}</span>}
              </div>
            </div>
            {row.member ? (
              <div className="flex shrink-0 items-center gap-2">
                {row.status === 'confirmed' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-ok-500" aria-label="Confirmed" /> : <span className="hidden shrink-0 text-[11px] text-ink-400 sm:inline">Not confirmed</span>}
                <a href={telHref(row.member.phone)} aria-label={`Call ${fullName(row.member)}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-medium text-ink-700 ring-1 ring-line hover:ring-line-strong sm:text-[12.5px]">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-wine-500" />
                  <span className="tabular">{formatPhone(row.member.phone)}</span>
                </a>
              </div>
            ) : row.away ? (
              <CalendarX2 className="mt-0.5 h-4 w-4 shrink-0 text-bad-500 sm:mt-0" aria-label="Can’t make it" />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
