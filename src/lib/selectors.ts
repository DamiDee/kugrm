import { useMemo } from 'react'
import { useStore } from '@/store/useStore'
import type { Assignment, Member, MinistryEvent, Position, Zone } from '@/data/types'
import { normalizePhone } from './utils'

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
  assignments: Assignment[]
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
  const assignments = s.assignments.filter((a) => a.eventId === eventId && memberById.has(a.memberId))
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
    event, zones, positionsByZone, positionById, zoneById, assignments, byMember, byZone, zoneStats,
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
}

export type LookupResult =
  | { kind: 'not-found'; phone: string }
  | { kind: 'unpublished'; member: Member; event: MinistryEvent; others: AssignmentView[] }
  | { kind: 'unassigned'; member: Member; event: MinistryEvent; others: AssignmentView[] }
  | { kind: 'found'; member: Member; current: AssignmentView; others: AssignmentView[] }

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
    const zoneAs = s.assignments.filter((x) => x.zoneId === zone.id)
    const posOrder = new Map(s.positions.filter((x) => x.zoneId === zone.id).map((x) => [x.id, x]))
    const lead = zoneAs.find((x) => x.isTeamLead)
    const teammates: Teammate[] = zoneAs
      .map((x) => ({ member: memberById.get(x.memberId)!, position: posOrder.get(x.positionId)!, isTeamLead: x.isTeamLead, isYou: x.memberId === member.id }))
      .filter((t) => t.member && t.position)
      .sort((a, b) => Number(b.isTeamLead) - Number(a.isTeamLead) || Number(b.isYou) - Number(a.isYou) || a.position.order - b.position.order || a.member.firstName.localeCompare(b.member.firstName))
    return { event, assignment: a, zone, position, teamLead: lead ? memberById.get(lead.memberId) : undefined, teammates }
  }

  const visible = s.assignments
    .filter((a) => a.memberId === member.id)
    .map((a) => ({ a, e: s.events.find((e) => e.id === a.eventId) }))
    .filter((x) => x.e && x.e.rosterStatus === 'published' && x.e.status !== 'archived')
    .map((x) => viewFor(x.a))
    .filter(Boolean) as AssignmentView[]

  const active = s.events.find((e) => e.id === s.activeEventId) ?? s.events[0]
  const others = visible.filter((v) => v.event.id !== active.id).sort((a, b) => a.event.date.localeCompare(b.event.date))
  if (active.rosterStatus !== 'published') return { kind: 'unpublished', member, event: active, others }
  const current = visible.find((v) => v.event.id === active.id)
  if (!current) return { kind: 'unassigned', member, event: active, others }
  return { kind: 'found', member, current, others }
}

/**
 * Who stands at each usher spot, by position id. `onlyZoneId` keeps names to
 * one zone (an usher's own section) and marks the rest just as taken.
 */
export function spotOccupants(data: EventData, members: Map<string, Member>, onlyZoneId?: string) {
  const out: Record<string, string> = {}
  for (const a of data.assignments) {
    const p = data.positionById.get(a.positionId)
    if (!p?.spot) continue
    const m = members.get(a.memberId)
    if (!m) continue
    out[p.id] = !onlyZoneId || a.zoneId === onlyZoneId ? `${m.firstName} ${m.lastName}` : 'Usher assigned'
  }
  return out
}

export function positionsOf(data: EventData) {
  return [...data.positionById.values()]
}
