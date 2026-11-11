import { useMemo } from 'react'
import { useStore } from '@/store/useStore'
import type { Assignment, Member, MinistryEvent, Position, Zone } from '@/data/types'
import { normalizePhone, sessionOrder } from './utils'

export interface ZoneStat {
  zone: Zone
  positions: Position[]
  assigned: number
  required: number
  coverage: number // 0-100, capped
  lead?: Member
}

export interface EventData {
  event?: MinistryEvent
  zones: Zone[]
  positionsByZone: Map<string, Position[]>
  positionById: Map<string, Position>
  zoneById: Map<string, Zone>
  /** working assignments: everyone except ushers who said they can't make it */
  assignments: Assignment[]
  /** ushers who said they can't make this session */
  unavailable: Assignment[]
  byMember: Map<string, Assignment>
  byZone: Map<string, Assignment[]>
  zoneStats: ZoneStat[]
  stats: { totalMembers: number; assigned: number; unassigned: number; positions: number; zones: number; coverage: number; required: number; confirmed: number }
}

export function computeEventData(
  eventId: string,
  s: { events: MinistryEvent[]; zones: Zone[]; positions: Position[]; assignments: Assignment[]; members: Member[] },
): EventData {
  const event = s.events.find((e) => e.id === eventId)
  const zones = s.zones.filter((z) => z.eventId === eventId).sort((a, b) => a.order - b.order)
  const zoneIds = new Set(zones.map((z) => z.id))
  const zoneById = new Map(zones.map((z) => [z.id, z]))
  const positionsByZone = new Map<string, Position[]>()
  const positionById = new Map<string, Position>()
  for (const p of s.positions) {
    if (!zoneIds.has(p.zoneId)) continue
    positionById.set(p.id, p)
    const arr = positionsByZone.get(p.zoneId) ?? []
    arr.push(p)
    positionsByZone.set(p.zoneId, arr)
  }
  positionsByZone.forEach((arr) => arr.sort((a, b) => a.order - b.order))
  const memberById = new Map(s.members.map((m) => [m.id, m]))
  const all = s.assignments.filter((a) => a.eventId === eventId && memberById.has(a.memberId))
  const assignments = all.filter((a) => a.status !== 'unavailable')
  const unavailable = all.filter((a) => a.status === 'unavailable')
  const byMember = new Map(assignments.map((a) => [a.memberId, a]))
  const byZone = new Map<string, Assignment[]>()
  for (const a of assignments) {
    const arr = byZone.get(a.zoneId) ?? []
    arr.push(a)
    byZone.set(a.zoneId, arr)
  }
  const zoneStats: ZoneStat[] = zones.map((zone) => {
    const positions = positionsByZone.get(zone.id) ?? []
    const list = byZone.get(zone.id) ?? []
    const required = positions.reduce((n, p) => n + (p.required ?? 0), 0)
    const leadA = list.find((a) => a.isTeamLead)
    return {
      zone, positions, assigned: list.length, required,
      coverage: required ? Math.min(100, Math.round((list.length / required) * 100)) : list.length ? 100 : 0,
      lead: leadA ? memberById.get(leadA.memberId) : undefined,
    }
  })
  const assigned = byMember.size
  const required = zoneStats.reduce((n, z) => n + z.required, 0)
  return {
    event, zones, positionsByZone, positionById, zoneById, assignments, unavailable, byMember, byZone, zoneStats,
    stats: {
      totalMembers: s.members.length, assigned, unassigned: Math.max(0, s.members.length - assigned),
      positions: positionById.size, zones: zones.length,
      coverage: s.members.length ? Number(((assigned / s.members.length) * 100).toFixed(1)) : 0,
      required, confirmed: assignments.filter((a) => a.status === 'confirmed').length,
    },
  }
}

export function useEventData(eventId: string) {
  const events = useStore((s) => s.events)
  const zones = useStore((s) => s.zones)
  const positions = useStore((s) => s.positions)
  const assignments = useStore((s) => s.assignments)
  const members = useStore((s) => s.members)
  return useMemo(() => computeEventData(eventId, { events, zones, positions, assignments, members }), [eventId, events, zones, positions, assignments, members])
}

export function useMemberMap() {
  const members = useStore((s) => s.members)
  return useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
}

export interface Teammate {
  member: Member
  position: Position
  isTeamLead: boolean
  isYou: boolean
}

export interface AssignmentView {
  event: MinistryEvent
  assignment: Assignment
  zone: Zone
  position: Position
  teamLead?: Member
  teammates: Teammate[]
  /** the coordinator over this zone, if one is set */
  coordinator?: Member
}

/** One session of the series the usher is looking at. */
export interface SessionEntry {
  event: MinistryEvent
  /** the usher's assignment in this session, when the roster is published */
  view?: AssignmentView
}

export type LookupResult =
  | { kind: 'not-found'; phone: string }
  | { kind: 'member'; member: Member; series?: string; sessions: SessionEntry[]; others: AssignmentView[] }

/** The coordinator who oversees a zone, by zone name. */
export function coordinatorFor(members: Member[], zoneName: string) {
  return members.find((m) => m.role === 'coordinator' && m.coordinates?.includes(zoneName))
}

/** The sessions of the event's series in service order, or just the event. */
export function sessionsOf(events: MinistryEvent[], event: MinistryEvent) {
  if (!event.series) return [event]
  return events.filter((e) => e.series === event.series && e.status !== 'archived').sort((a, b) => sessionOrder(a).localeCompare(sessionOrder(b)))
}

export function lookupByPhone(phone: string): LookupResult {
  const s = useStore.getState()
  const p = normalizePhone(phone)
  const member = s.members.find((m) => m.phone === p)
  if (!member) return { kind: 'not-found', phone: p }
  const memberById = new Map(s.members.map((m) => [m.id, m]))

  const viewFor = (a: Assignment): AssignmentView | null => {
    const event = s.events.find((e) => e.id === a.eventId)
    const zone = s.zones.find((z) => z.id === a.zoneId)
    const position = s.positions.find((x) => x.id === a.positionId)
    if (!event || !zone || !position) return null
    const zoneAs = s.assignments.filter((x) => x.zoneId === zone.id && (x.status !== 'unavailable' || x.memberId === member.id))
    const posOrder = new Map(s.positions.filter((x) => x.zoneId === zone.id).map((x) => [x.id, x]))
    const lead = zoneAs.find((x) => x.isTeamLead && x.status !== 'unavailable')
    const teammates: Teammate[] = zoneAs
      .map((x) => ({ member: memberById.get(x.memberId)!, position: posOrder.get(x.positionId)!, isTeamLead: x.isTeamLead, isYou: x.memberId === member.id }))
      .filter((t) => t.member && t.position)
      .sort((a, b) => Number(b.isTeamLead) - Number(a.isTeamLead) || Number(b.isYou) - Number(a.isYou) || a.position.order - b.position.order || a.member.firstName.localeCompare(b.member.firstName))
    return { event, assignment: a, zone, position, teamLead: lead ? memberById.get(lead.memberId) : undefined, teammates, coordinator: coordinatorFor(s.members, zone.name) }
  }

  const mine = s.assignments.filter((a) => a.memberId === member.id)
  const active = s.events.find((e) => e.id === s.activeEventId) ?? s.events[0]
  const sessions: SessionEntry[] = sessionsOf(s.events, active).map((event) => {
    const a = event.rosterStatus === 'published' ? mine.find((x) => x.eventId === event.id) : undefined
    return { event, view: a ? viewFor(a) ?? undefined : undefined }
  })
  const inSeries = new Set(sessions.map((x) => x.event.id))
  const others = mine
    .map((a) => ({ a, e: s.events.find((e) => e.id === a.eventId) }))
    .filter((x) => x.e && !inSeries.has(x.e.id) && x.e.rosterStatus === 'published' && x.e.status !== 'archived')
    .map((x) => viewFor(x.a))
    .filter(Boolean)
    .sort((a, b) => a!.event.date.localeCompare(b!.event.date)) as AssignmentView[]
  return { kind: 'member', member, series: active.series, sessions, others }
}

/**
 * Who stands at each usher spot, by position id. `onlyZoneId` keeps names to
 * one zone (an usher's own section) and marks the rest just as taken.
 */
export function spotOccupants(data: EventData, members: Map<string, Member>, onlyZoneId?: string | string[]) {
  const only = onlyZoneId == null ? undefined : new Set(Array.isArray(onlyZoneId) ? onlyZoneId : [onlyZoneId])
  const out: Record<string, string> = {}
  for (const a of data.assignments) {
    const p = data.positionById.get(a.positionId)
    if (!p?.spot) continue
    const m = members.get(a.memberId)
    if (!m) continue
    out[p.id] = !only || only.has(a.zoneId) ? `${m.firstName} ${m.lastName}` : 'Usher assigned'
  }
  return out
}

export function positionsOf(data: EventData) {
  return [...data.positionById.values()]
}

/** Open usher seats whose usher said they can't make it, by position id → their name. */
export function uncoveredSpots(data: EventData, members: Map<string, Member>) {
  const taken = new Set(data.assignments.map((a) => a.positionId))
  const out: Record<string, string> = {}
  for (const a of data.unavailable) {
    const p = data.positionById.get(a.positionId)
    const m = members.get(a.memberId)
    if (p?.spot && m && !taken.has(p.id)) out[p.id] = `${m.firstName} ${m.lastName}`
  }
  return out
}

/** Absences in a session, with whether someone has covered each one. */
export function absenceList(data: EventData, members: Map<string, Member>) {
  return data.unavailable
    .map((a) => {
      const p = data.positionById.get(a.positionId)
      const covered = p?.spot
        ? data.assignments.some((x) => x.positionId === a.positionId)
        : (data.assignments.filter((x) => x.positionId === a.positionId).length >= (p?.required ?? 0))
      return { assignment: a, member: members.get(a.memberId)!, zone: data.zoneById.get(a.zoneId)!, position: p!, covered }
    })
    .filter((x) => x.member && x.zone && x.position)
    .sort((a, b) => Number(a.covered) - Number(b.covered) || a.zone.order - b.zone.order)
}

/** Returns all leader IDs a coordinator reports to (`leaderIds` or single `leaderId`). */
export function leaderIdsOf(m: Member): string[] {
  if (m.leaderIds?.length) return m.leaderIds
  return m.leaderId ? [m.leaderId] : []
}

/** What a coordinator or leader can see: the zones they oversee and, for a leader, their coordinators. */
export function teamScope(me: Member, members: Member[]) {
  const coordinators = me.role === 'leader' ? members.filter((m) => m.role === 'coordinator' && leaderIdsOf(m).includes(me.id)) : me.role === 'coordinator' ? [me] : []
  const zoneNames = new Set(coordinators.flatMap((c) => c.coordinates ?? []))
  return { coordinators, zoneNames }
}
