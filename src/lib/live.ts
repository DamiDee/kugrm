/* eslint-disable @typescript-eslint/no-explicit-any -- this file maps raw API responses */
import { useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'
import { toast } from '@/components/ui/Toast'
import type { Assignment, FallbackKeyResponse, Member, MinistryEvent, Position, Zone } from '@/data/types'
import { LIVE, api, ApiError, setOnSignedOut, setOnTeamSignedOut, tokens } from './api'
import { normalizePhone } from './utils'
import { coordinatorsFor, leadersForMember, leadersForZone, type LookupResult } from './selectors'

/**
 * Connects the store to the backend. Screens keep reading the store: it is
 * filled from the API, and each store action still updates the screen at once,
 * then sends the change and reloads what the server says is true.
 */

const PAGE = 200
const items = <T,>(r: any): T[] => (Array.isArray(r) ? r : r?.items ?? r?.data ?? [])
const set = useStore.setState
const get = useStore.getState

async function allPages<T>(path: string, query: Record<string, string | number> = {}) {
  const out: T[] = []
  for (let page = 1; ; page++) {
    const r = await api(path, { as: 'admin', query: { ...query, page, pageSize: PAGE } })
    const batch = items<T>(r)
    out.push(...batch)
    if (Array.isArray(r) || batch.length < PAGE || (r?.total && out.length >= r.total)) return out
  }
}

/* ---------- mapping ---------- */

const toZone = (z: any, eventId: string): Zone => ({ id: z.id, name: z.name, eventId: z.eventId ?? eventId, kind: z.kind, order: z.order ?? 0, mapRef: z.mapRef ?? undefined })
const toPosition = (p: any, zoneId: string): Position => ({
  id: p.id, name: p.name, zoneId: p.zoneId ?? zoneId, order: p.order ?? 0, isLeadRole: p.isLeadRole ?? undefined,
  required: p.required ?? undefined, spot: p.spot ?? undefined, duty: p.duty ?? undefined,
})
const toAssignment = (a: any, eventId: string): Assignment => ({
  id: a.id, memberId: a.memberId ?? a.member?.id, eventId: a.eventId ?? eventId, zoneId: a.zoneId, positionId: a.positionId,
  isTeamLead: !!a.isTeamLead, status: a.status, unavailableReason: a.unavailableReason ?? undefined, updatedAt: a.updatedAt ?? '',
})

function mergeEvents(incoming: MinistryEvent[]) {
  const map = new Map(get().events.map((e) => [e.id, e]))
  incoming.forEach((e) => map.set(e.id, { ...map.get(e.id), ...e }))
  return [...map.values()]
}

function replaceRoster(eventId: string, zones: Zone[], positions: Position[], assignments: Assignment[]) {
  set((s) => {
    const old = new Set(s.zones.filter((z) => z.eventId === eventId).map((z) => z.id))
    return {
      zones: [...s.zones.filter((z) => z.eventId !== eventId), ...zones],
      positions: [...s.positions.filter((p) => !old.has(p.zoneId)), ...positions],
      assignments: [...s.assignments.filter((a) => a.eventId !== eventId), ...assignments],
    }
  })
}

/* ---------- loading ---------- */

export async function loadPublic() {
  const [cur, settings] = await Promise.all([api('/public/current-event'), api('/public/settings')])
  const events: MinistryEvent[] = cur.event ? (cur.sessions?.length ? cur.sessions : [cur.event]).map((s: any) => ({ ...cur.event, ...s })) : []
  set({ events: mergeEvents(events), activeEventId: cur.event?.id ?? '', publicAssigned: cur.stats?.assigned, settings: { ...get().settings, ...settings } })
}

export async function loadRoster(eventId: string) {
  const [zs, as] = await Promise.all([
    api(`/events/${eventId}/zones`, { as: 'admin', query: { include: 'positions,stats' } }),
    allPages<any>(`/events/${eventId}/assignments`),
  ])
  const raw = items<any>(zs)
  replaceRoster(eventId, raw.map((z) => toZone(z, eventId)), raw.flatMap((z) => (z.positions ?? []).map((p: any) => toPosition(p, z.id))), as.map((a) => toAssignment(a, eventId)))
}

const toMember = (m: any): Member => {
  const leaderIds = Array.isArray(m.leaderIds) && m.leaderIds.length ? m.leaderIds : m.leaderId ? [m.leaderId] : undefined
  return {
    ...m,
    status: m.status ?? 'active',
    leaderId: leaderIds?.[0] ?? m.leaderId,
    leaderIds,
  }
}

const loadEvents = async () => set({ events: items<MinistryEvent>(await api('/events', { as: 'admin' })) })
const loadMembers = async () => {
  const list = (await allPages<any>('/members')).map(toMember)
  set({ members: list })
}
export async function loadFeeds() {
  const [activity, notes] = await Promise.all([api('/activity', { as: 'admin', query: { limit: 60 } }), api('/notifications', { as: 'admin' })])
  set({ activity: items(activity), notifications: items(notes) })
}

export async function syncAdmin() {
  const [settings, me] = await Promise.all([
    api('/settings', { as: 'admin' }),
    api('/auth/me', { as: 'admin', cache: 'no-store' }).catch(() => null),
    loadEvents(),
    loadMembers(),
    loadFeeds(),
  ])
  if (me) {
    set((s) => ({
      admin: {
        id: me.id ?? s.admin?.id,
        name: me.name ?? s.admin?.name ?? 'Admin',
        email: me.email ?? s.admin?.email ?? '',
        role: me.role ?? s.admin?.role ?? 'admin',
      },
    }))
  }
  const { currentEventId, ...rest } = settings ?? {}
  const events = get().events
  const active = events.find((e) => e.id === currentEventId)?.id ?? events[0]?.id ?? ''
  set({ settings: { ...get().settings, ...rest }, activeEventId: active })
  if (active) await loadRoster(active)
  set({ liveReady: true })
  // the other sessions follow in the background, for session pickers and member history
  for (const e of events) if (e.id !== active) await loadRoster(e.id).catch(() => {})
}

/* ---------- sending changes ---------- */

type Dirty = { events?: boolean; members?: boolean; roster?: string | string[] }
let queue: Promise<unknown> = Promise.resolve()
let pending = 0
const dirty = { events: false, members: false, rosters: new Set<string>() }

async function refresh() {
  const rosters = [...dirty.rosters]
  const { events, members } = dirty
  dirty.events = dirty.members = false
  dirty.rosters.clear()
  await Promise.all([events && loadEvents(), members && loadMembers(), ...rosters.map(loadRoster), loadFeeds()].filter(Boolean)).catch(() => {})
}

/** Runs changes one after another, then reloads what they touched. */
function push(call: () => Promise<unknown>, touches: Dirty = {}) {
  pending++
  dirty.events ||= !!touches.events
  dirty.members ||= !!touches.members
  ;[touches.roster].flat().forEach((r) => r && dirty.rosters.add(r))
  queue = queue
    .then(call)
    .catch((e: unknown) => toast.error('That change wasn’t saved.', e instanceof ApiError ? e.message : undefined))
    .finally(() => { if (--pending === 0) void refresh() })
}

const eventOfZone = (zoneId: string) => get().zones.find((z) => z.id === zoneId)?.eventId
const eventOfPosition = (id: string) => eventOfZone(get().positions.find((p) => p.id === id)?.zoneId ?? '')
const eventOfAssignment = (id: string) => get().assignments.find((a) => a.id === id)?.eventId
const admin = { as: 'admin' as const }

function installActions() {
  const o = get()
  set({
    logout: () => {
      api('/auth/logout', { ...admin, method: 'POST', cache: 'no-store' }).catch(() => {})
      tokens.set('access'); tokens.set('refresh')
      o.logout()
      set({ liveReady: false })
    },
    teamLogout: () => {
      api('/team/auth/logout', { as: 'team', method: 'POST', cache: 'no-store' }).catch(() => {})
      tokens.set('team')
      o.teamLogout()
    },
    setActiveEvent: (id) => {
      o.setActiveEvent(id)
      push(() => api('/settings/current-event', { ...admin, method: 'PUT', body: { eventId: id } }), { roster: id })
    },
    markNotificationsRead: () => { o.markNotificationsRead(); push(() => api('/notifications/read-all', { ...admin, method: 'POST' })) },
    setTeamRole: (id, role, opts = {}) => {
      o.setTeamRole(id, role, opts)
      const leaderIds = opts.leaderIds ?? (opts.leaderId ? [opts.leaderId] : [])
      const body =
        role === 'leader'
          ? { role: 'leader' }
          : role === 'usher'
            ? { role: 'usher' }
            : {
                role: 'coordinator',
                coordinates: opts.coordinates ?? [],
                leaderIds,
                ...(leaderIds.length === 1 ? { leaderId: leaderIds[0] } : {}),
              }
      push(() => api(`/members/${id}/role`, { ...admin, method: 'PUT', body, cache: 'no-store' }), { members: true })
    },

    updateEvent: (id, patch) => { o.updateEvent(id, patch); push(() => api(`/events/${id}`, { ...admin, method: 'PATCH', body: patch }), { events: true }) },
    duplicateEvent: (id) => { push(() => api(`/events/${id}/duplicate`, { ...admin, method: 'POST' }).then((e: MinistryEvent) => loadRoster(e.id)), { events: true }); return '' },
    archiveEvent: (id) => { o.archiveEvent(id); push(() => api(`/events/${id}/archive`, { ...admin, method: 'POST' }), { events: true }) },
    deleteEvent: (id) => { o.deleteEvent(id); push(() => api(`/events/${id}`, { ...admin, method: 'DELETE' }), { events: true }) },
    setRosterStatus: (id, status) => { o.setRosterStatus(id, status); push(() => api(`/events/${id}/${status === 'published' ? 'publish' : 'unpublish'}`, { ...admin, method: 'POST' }), { events: true }) },

    addMember: (m) => {
      const id = o.addMember(m)
      const body: Partial<Member> = { ...m }
      delete body.memberId // the server numbers members
      push(() => api('/members', { ...admin, method: 'POST', body }), { members: true })
      return id
    },
    updateMember: (id, patch) => { o.updateMember(id, patch); push(() => api(`/members/${id}`, { ...admin, method: 'PATCH', body: patch }), { members: true }) },
    deleteMembers: (ids) => {
      const rosters = [...new Set(get().assignments.filter((a) => ids.includes(a.memberId)).map((a) => a.eventId))]
      o.deleteMembers(ids)
      push(() => api('/members/bulk-delete', { ...admin, method: 'POST', body: { memberIds: ids } }), { members: true, roster: rosters })
    },

    assign: (a) => {
      o.assign(a)
      push(() => api(`/events/${a.eventId}/assignments`, { ...admin, method: 'POST', body: { memberId: a.memberId, zoneId: a.zoneId, positionId: a.positionId, isTeamLead: !!a.isTeamLead, replace: true } }), { roster: a.eventId })
    },
    removeAssignment: (id) => { const roster = eventOfAssignment(id); o.removeAssignment(id); push(() => api(`/assignments/${id}`, { ...admin, method: 'DELETE' }), { roster }) },
    removeAssignmentsFor: (ids, eventId) => { const n = o.removeAssignmentsFor(ids, eventId); push(() => api(`/events/${eventId}/assignments/bulk-remove`, { ...admin, method: 'POST', body: { memberIds: ids } }), { roster: eventId }); return n },
    bulkAssign: (ids, eventId, zoneId, positionId) => { const n = o.bulkAssign(ids, eventId, zoneId, positionId); push(() => api(`/events/${eventId}/assignments/bulk`, { ...admin, method: 'POST', body: { memberIds: ids, zoneId, positionId } }), { roster: eventId }); return n },
    moveToEvent: (ids, from, to) => { const n = o.moveToEvent(ids, from, to); push(() => api(`/events/${from}/assignments/copy`, { ...admin, method: 'POST', body: { toEventId: to, memberIds: ids } }), { roster: to }); return n },
    copyRoster: (from, to) => {
      const n = new Set(get().assignments.filter((a) => a.eventId === from).map((a) => a.memberId)).size
      push(() => api(`/events/${to}/roster/copy-from`, { ...admin, method: 'POST', body: { fromEventId: from } }), { roster: to })
      return n
    },
    confirmAssignment: (id) => { const roster = eventOfAssignment(id); o.confirmAssignment(id); push(() => api(`/assignments/${id}/confirm`, { ...admin, method: 'POST' }), { roster }) },

    addZone: (eventId, name, kind) => { const id = o.addZone(eventId, name, kind); push(() => api(`/events/${eventId}/zones`, { ...admin, method: 'POST', body: { name, kind } }), { roster: eventId }); return id },
    renameZone: (id, name) => { const roster = eventOfZone(id); o.renameZone(id, name); push(() => api(`/zones/${id}`, { ...admin, method: 'PATCH', body: { name } }), { roster }) },
    deleteZone: (id) => { const roster = eventOfZone(id); o.deleteZone(id); push(() => api(`/zones/${id}`, { ...admin, method: 'DELETE' }), { roster }) },
    addPosition: (zoneId, name, required = 4) => { o.addPosition(zoneId, name, required); push(() => api(`/zones/${zoneId}/positions`, { ...admin, method: 'POST', body: { name, required } }), { roster: eventOfZone(zoneId) }) },
    updatePosition: (id, patch) => {
      const roster = eventOfPosition(id)
      o.updatePosition(id, patch)
      push(() => api(`/positions/${id}`, { ...admin, method: 'PATCH', body: { name: patch.name, required: patch.required, isLeadRole: patch.isLeadRole, duty: patch.duty } }), { roster })
    },
    deletePosition: (id) => { const roster = eventOfPosition(id); o.deletePosition(id); push(() => api(`/positions/${id}`, { ...admin, method: 'DELETE' }), { roster }) },
    reorderPositions: (zoneId, ids) => { o.reorderPositions(zoneId, ids); push(() => api(`/zones/${zoneId}/positions/order`, { ...admin, method: 'PUT', body: { positionIds: ids } }), { roster: eventOfZone(zoneId) }) },

    updateSettings: (patch) => { o.updateSettings(patch); push(() => api('/settings', { ...admin, method: 'PATCH', body: patch })) },
  })
}

/* ---------- sign-in ---------- */

export async function adminLogin(email: string, password: string, remember: boolean) {
  const r = await api('/auth/login', { method: 'POST', body: { email, password, remember }, cache: 'no-store' })
  tokens.set('access', r.accessToken, remember)
  tokens.set('refresh', r.refreshToken, remember)
  set({
    admin: {
      id: r.user?.id,
      name: r.user?.name ?? email.split('@')[0],
      email: r.user?.email ?? email,
      role: r.user?.role ?? 'admin',
    },
    liveReady: false,
  })
  void syncAdmin().catch(showLoadError)
}

export async function adminForgotPassword(email: string) {
  await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() }, cache: 'no-store' })
}

export async function adminResetPassword(token: string, password: string) {
  await api('/auth/reset-password', { method: 'POST', body: { token: token.trim(), password }, cache: 'no-store' })
  tokens.set('access')
  tokens.set('refresh')
  set({ admin: null, liveReady: false })
}

/** Creates an event on the server, so the app can open it by its real id. */
export async function createEventLive(e: Omit<MinistryEvent, 'id'>) {
  const copyFrom = get().activeEventId
  const created: MinistryEvent = await api('/events', { ...admin, method: 'POST', body: { ...e, ...(copyFrom ? { copyStructureFrom: copyFrom } : { useTemplate: true }) } })
  await loadEvents()
  await loadRoster(created.id)
  if (!get().activeEventId) set({ activeEventId: created.id })
  return created.id
}

export async function importFileLive(file: File, eventId: string) {
  const form = new FormData()
  form.append('file', file)
  form.append('eventId', eventId)
  const preview = await api('/imports/preview', { ...admin, method: 'POST', form })
  const r = await api(`/imports/${preview.importId}/commit`, { ...admin, method: 'POST', body: { updateExisting: false, assign: true } })
  await Promise.all([loadMembers(), loadRoster(eventId), loadFeeds()])
  return { members: (r.added ?? 0) + (r.updated ?? 0), assignments: r.assigned ?? 0 }
}

/* ---------- coordinators and leaders ---------- */

export const teamRequestCode = (phone: string) => api('/team/auth/request-code', { method: 'POST', body: { phone: normalizePhone(phone) } })

/** After a team sign-in: keep the token in memory only, then load the team page. */
async function startTeamSession(r: any) {
  tokens.set('team', r.accessToken)
  const m = r.member
  const known = get().members.find((x) => x.id === m.id)
  set((s) => ({ teamUser: { memberId: m.id }, teamNoSession: false, members: [...s.members.filter((x) => x.id !== m.id), { status: 'active', ...known, ...m }] }))
  await loadTeam().catch((e: unknown) => { if (!(e instanceof ApiError && e.status === 404)) throw e })
}

export async function teamVerify(phone: string, code: string) {
  await startTeamSession(await api('/team/auth/verify', { method: 'POST', body: { phone: normalizePhone(phone), code }, cache: 'no-store' }))
}

/** Sign-in with the member's six-character offline key. The key is not kept anywhere. */
export async function teamFallback(phone: string, key: string) {
  await startTeamSession(await api('/team/auth/fallback', { method: 'POST', body: { phone: normalizePhone(phone), key: key.trim() }, cache: 'no-store' }))
}

/* ---------- offline keys (owner and admin only) ---------- */

export const getFallbackKey = async (memberId: string) => {
  const res = await api<FallbackKeyResponse>(`/members/${memberId}/fallback-key`, { ...admin, cache: 'no-store' })
  void loadFeeds().catch(() => {})
  return res
}
/** Not idempotent: never call twice for one click, never retry. */
export const rotateFallbackKey = async (memberId: string) => {
  const res = await api<FallbackKeyResponse>(`/members/${memberId}/fallback-key/rotate`, { ...admin, method: 'POST', cache: 'no-store' })
  void loadFeeds().catch(() => {})
  return res
}

const teamMember = (m: any, extra: Partial<Member> = {}): Member => {
  const rawIds = [
    ...(Array.isArray(m?.leaderIds) ? m.leaderIds : []),
    ...(Array.isArray(m?.leaders) ? m.leaders.map((l: any) => (typeof l === 'string' ? l : l?.id)).filter(Boolean) : []),
    m?.leaderId,
    m?.leader?.id,
    ...(Array.isArray(extra.leaderIds) ? extra.leaderIds : []),
    extra.leaderId,
  ].filter(Boolean) as string[]
  const leaderIds = rawIds.length ? [...new Set(rawIds)] : undefined
  return {
    status: 'active',
    phone: '',
    ...m,
    ...extra,
    leaderId: leaderIds?.[0] ?? extra.leaderId ?? m?.leaderId,
    leaderIds,
  }
}

const extractPeopleList = (raw: any, role?: Member['role']): Member[] => {
  if (!raw) return []
  const arr = Array.isArray(raw) ? raw : [raw]
  const out: Member[] = []
  const seen = new Set<string>()
  for (const item of arr) {
    const m = item?.member ?? item
    if (!m || typeof m !== 'object') continue
    const id = m.id ?? (m.phone || m.firstName ? `${role ?? 'm'}_${m.phone || `${m.firstName}_${m.lastName}`}` : undefined)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(teamMember({ ...m, id }, role ? { role } : {}))
  }
  return out
}

/** Fills the store from /team/me, so the team page reads it like any other roster. */
export async function loadTeam(eventId?: string) {
  let r: any
  try {
    r = await api('/team/me', { as: 'team', query: { eventId }, cache: 'no-store' })
  } catch (e) {
    // signed in, but no session has been set as current yet
    if (e instanceof ApiError && e.status === 404) set({ teamNoSession: true })
    throw e
  }
  set({ teamNoSession: false })
  const ev: MinistryEvent = r.event
  const zones: Zone[] = []
  const positions: Position[] = []
  const assignments: Assignment[] = []
  const people = new Map<string, Member>()
  const add = (m: Member) => {
    const prev = people.get(m.id)
    const leaderIds = [...new Set([...(prev?.leaderIds ?? []), ...(m.leaderIds ?? []), ...(prev?.leaderId ? [prev.leaderId] : []), ...(m.leaderId ? [m.leaderId] : [])])]
    const coordinates = [...new Set([...(prev?.coordinates ?? []), ...(m.coordinates ?? [])])]
    people.set(m.id, {
      ...prev,
      ...m,
      ...(leaderIds.length ? { leaderId: leaderIds[0], leaderIds } : {}),
      ...(coordinates.length ? { coordinates } : {}),
    })
  }

  const meLeaders = [
    ...extractPeopleList(r.me?.leaders, 'leader'),
    ...extractPeopleList(r.me?.leader, 'leader'),
    ...extractPeopleList(r.leaders, 'leader'),
    ...extractPeopleList(r.leader, 'leader'),
  ]
  meLeaders.forEach(add)
  const meLeaderIds = [
    ...(r.me?.role === 'leader' ? [r.me.id] : []),
    ...meLeaders.map((l) => l.id),
    ...(Array.isArray(r.me?.leaderIds) ? r.me.leaderIds : []),
    ...(r.me?.leaderId ? [r.me.leaderId] : []),
  ].filter(Boolean) as string[]

  const rawCoordinators = r.coordinators?.length
    ? r.coordinators
    : r.me?.role === 'coordinator'
      ? [{ member: r.me, zones: r.zones ?? r.me?.zones ?? [], leaders: meLeaders }]
      : []

  for (const c of rawCoordinators) {
    const cLeaders = [
      ...extractPeopleList(c.leaders, 'leader'),
      ...extractPeopleList(c.leader, 'leader'),
      ...extractPeopleList(c.member?.leaders, 'leader'),
      ...extractPeopleList(c.member?.leader, 'leader'),
    ]
    cLeaders.forEach(add)
    const zoneLeaderIds: string[] = []
    for (const z of c.zones ?? []) {
      const zObj = z.zone ?? z
      zones.push(toZone(zObj, ev.id))
      positions.push(...(z.positions ?? zObj.positions ?? []).map((p: any) => toPosition(p, zObj.id)))
      const zLeaders = [
        ...extractPeopleList(z.leaders, 'leader'),
        ...extractPeopleList(z.leader, 'leader'),
        ...extractPeopleList(zObj.leaders, 'leader'),
        ...extractPeopleList(zObj.leader, 'leader'),
      ]
      zLeaders.forEach((l) => {
        add(l)
        zoneLeaderIds.push(l.id)
      })
      for (const u of z.ushers ?? []) {
        add(teamMember(u.member ?? u))
        const mObj = u.member ?? u
        assignments.push({ id: u.assignmentId ?? u.id, memberId: mObj.id, eventId: ev.id, zoneId: zObj.id, positionId: u.positionId, isTeamLead: !!u.isTeamLead, status: u.status ?? 'assigned', updatedAt: '' })
      }
      for (const u of z.unavailable ?? []) {
        const mObj = u.member ?? u
        const id = mObj.id ?? `away_${u.assignmentId ?? u.id}`
        add(teamMember(mObj, { id }))
        assignments.push({ id: u.assignmentId ?? u.id, memberId: id, eventId: ev.id, zoneId: zObj.id, positionId: u.positionId, isTeamLead: false, status: 'unavailable', unavailableReason: u.reason ?? u.unavailableReason ?? undefined, updatedAt: '' })
      }
    }
    const cMember = c.member ?? c
    const cLeaderIds = [...new Set([
      ...meLeaderIds,
      ...cLeaders.map((l) => l.id),
      ...zoneLeaderIds,
      ...(Array.isArray(c.leaderIds) ? c.leaderIds : []),
      ...(c.leaderId ? [c.leaderId] : []),
      ...(Array.isArray(cMember?.leaderIds) ? cMember.leaderIds : []),
      ...(cMember?.leaderId ? [cMember.leaderId] : []),
    ])]
    const cCoords = [...new Set([
      ...(c.zones ?? []).map((z: any) => (z.zone ?? z)?.name).filter(Boolean),
      ...(Array.isArray(c.coordinates) ? c.coordinates : []),
      ...(Array.isArray(cMember?.coordinates) ? cMember.coordinates : []),
      ...(cMember?.id === r.me?.id && Array.isArray(r.me?.coordinates) ? r.me.coordinates : []),
    ])]
    if (cMember?.id) {
      add(teamMember(cMember, {
        role: 'coordinator',
        leaderId: cLeaderIds[0],
        leaderIds: cLeaderIds,
        coordinates: cCoords,
      }))
    }
  }
  const myCoordinates = [...new Set([
    ...(Array.isArray(r.me?.coordinates) ? r.me.coordinates : []),
    ...(people.get(r.me.id)?.coordinates ?? []),
  ])]
  add(teamMember(
    { id: r.me.id, firstName: r.me.firstName, lastName: r.me.lastName, phone: r.me.phone },
    {
      role: r.me.role,
      ...(r.me.role === 'coordinator' ? { leaderId: meLeaderIds[0], leaderIds: meLeaderIds, coordinates: myCoordinates } : {}),
    },
  ))
  const known = new Map(get().members.map((m) => [m.id, m]))
  people.forEach((m, id) => {
    const prev = known.get(id)
    const leaderIds = [...new Set([...(prev?.leaderIds ?? []), ...(m.leaderIds ?? []), ...(prev?.leaderId ? [prev.leaderId] : []), ...(m.leaderId ? [m.leaderId] : [])])]
    const coordinates = [...new Set([...(prev?.coordinates ?? []), ...(m.coordinates ?? [])])]
    known.set(id, {
      ...prev,
      ...m,
      ...(leaderIds.length ? { leaderId: leaderIds[0], leaderIds } : {}),
      ...(coordinates.length ? { coordinates } : {}),
    })
  })
  const sessions: MinistryEvent[] = (r.sessions?.length ? r.sessions : [ev]).map((s: any) => ({ ...ev, ...(s.id === ev.id ? ev : s) }))
  set({ members: [...known.values()], events: mergeEvents(sessions), activeEventId: get().activeEventId || ev.id, teamUser: { memberId: r.me.id } })
  replaceRoster(ev.id, zones, positions, assignments)
  return ev.id
}

/* ---------- ushers ---------- */

export interface LiveMap {
  zones: Zone[]
  positions: Position[]
  /** position id → who stands there; other ushers' names stay private */
  occupants: Record<string, string>
}

function toView(v: any, event: MinistryEvent, root?: any) {
  const zone = toZone(v.zone, event.id)
  const position = toPosition(v.position, v.zone?.id)
  const teammates = (v.teammates ?? []).map((t: any, i: number) => ({
    ...t,
    member: { id: t.member?.id ?? `teammate_${i}`, status: 'active', phone: '', ...t.member },
    position: toPosition({ order: i, ...t.position }, v.zone?.id),
  }))
  const storeMembers = get().members

  const rawCoordinators = [
    ...extractPeopleList(v.coordinators, 'coordinator'),
    ...extractPeopleList(v.coordinator, 'coordinator'),
    ...extractPeopleList(v.zone?.coordinators, 'coordinator'),
    ...extractPeopleList(v.zone?.coordinator, 'coordinator'),
    ...extractPeopleList(root?.coordinators, 'coordinator'),
    ...extractPeopleList(root?.coordinator, 'coordinator'),
    ...coordinatorsFor(storeMembers, zone.name),
  ]
  const seenCoord = new Set<string>()
  const coordinators = rawCoordinators.filter((c) => {
    const key = c.id || `${c.firstName}_${c.lastName}_${c.phone}`
    if (seenCoord.has(key)) return false
    seenCoord.add(key)
    return true
  })

  const rawCoordObjs = [
    ...(Array.isArray(v.coordinators) ? v.coordinators : []),
    v.coordinator,
    ...(Array.isArray(v.zone?.coordinators) ? v.zone.coordinators : []),
    v.zone?.coordinator,
  ].filter(Boolean)

  const rawLeaders = [
    ...extractPeopleList(v.leaders, 'leader'),
    ...extractPeopleList(v.leader, 'leader'),
    ...extractPeopleList(v.zone?.leaders, 'leader'),
    ...extractPeopleList(v.zone?.leader, 'leader'),
    ...rawCoordObjs.flatMap((c: any) => [
      ...extractPeopleList(c?.leaders, 'leader'),
      ...extractPeopleList(c?.leader, 'leader'),
      ...extractPeopleList(c?.member?.leaders, 'leader'),
      ...extractPeopleList(c?.member?.leader, 'leader'),
    ]),
    ...extractPeopleList(root?.leaders, 'leader'),
    ...extractPeopleList(root?.leader, 'leader'),
    ...extractPeopleList(root?.member?.leaders, 'leader'),
    ...extractPeopleList(root?.member?.leader, 'leader'),
    ...coordinators.flatMap((c) => leadersForMember(c, storeMembers)),
    ...leadersForZone(storeMembers, zone.name),
  ]
  const seenLeader = new Set<string>()
  const leaders = rawLeaders.filter((l) => {
    const key = l.id || `${l.firstName}_${l.lastName}_${l.phone}`
    if (seenLeader.has(key)) return false
    seenLeader.add(key)
    return true
  })

  const teamLead = v.teamLead
    ? teamMember(v.teamLead)
    : teammates.find((t: any) => t.isTeamLead)?.member

  return {
    ...v,
    event,
    assignment: { ...v.assignment, eventId: event.id, zoneId: v.zone?.id, positionId: v.position?.id },
    zone,
    position,
    teamLead,
    teammates,
    coordinator: coordinators[0],
    coordinators,
    leader: leaders[0],
    leaders,
  }
}

export async function lookupLive(phone: string): Promise<LookupResult> {
  const r = await api('/public/lookup', { method: 'POST', body: { phone } })
  if (r.kind === 'not-found') {
    if (r.contact) set({ settings: { ...get().settings, contactName: r.contact.name, contactPhone: r.contact.phone } })
    return { kind: 'not-found', phone: r.phone }
  }
  return {
    kind: 'member',
    member: teamMember({ phone: normalizePhone(phone), ...r.member }),
    series: r.series ?? undefined,
    sessions: (r.sessions ?? []).map((s: any) => ({ event: s.event, view: s.view ? toView(s.view, s.event, r) : undefined })),
    others: (r.others ?? []).map((o: any) => toView(o, o.event, r)),
  }
}

const publicAction = (id: string, action: string, body: object) => api(`/public/assignments/${id}/${action}`, { method: 'POST', body })
export const confirmLive = (id: string, phone: string) => publicAction(id, 'confirm', { phone })
export const unavailableLive = (id: string, phone: string, reason?: string) => publicAction(id, 'unavailable', { phone, reason: reason?.trim() || undefined })
export const availableLive = (id: string, phone: string) => publicAction(id, 'available', { phone })

/** The floor plan for one published session, with this usher's team named. */
export function useLiveMap(eventId: string, own: Position, teammates: { position: Position; member: Member }[]): LiveMap {
  const [map, setMap] = useState<LiveMap>({ zones: [], positions: [own], occupants: {} })
  const names = teammates.map((t) => `${t.position.id}:${t.member.firstName}`).join()
  useEffect(() => {
    if (!LIVE) return
    let on = true
    api(`/public/events/${eventId}/map`)
      .then((r) => {
        if (!on) return
        const spots: any[] = r.spots ?? []
        const named = new Map(teammates.map((t) => [t.position.id, `${t.member.firstName} ${t.member.lastName}`]))
        const positions = spots.map((s, i) => toPosition({ id: s.positionId, name: s.name, order: i, required: 1, spot: s.spot }, s.zoneId))
        if (!positions.some((p) => p.id === own.id)) positions.push(own)
        setMap({
          zones: items<any>(r.zones).map((z) => toZone(z, eventId)),
          positions,
          occupants: Object.fromEntries(spots.filter((s) => s.taken).map((s) => [s.positionId, named.get(s.positionId) ?? 'Usher assigned'])),
        })
      })
      .catch(() => {})
    return () => { on = false }
  }, [eventId, names]) // eslint-disable-line react-hooks/exhaustive-deps
  return map
}

/* ---------- start-up ---------- */

function showLoadError(e: unknown) {
  set({ liveReady: true })
  toast.error('Couldn’t load from the server.', e instanceof ApiError ? e.message : undefined)
}

export function bootLive() {
  if (!LIVE) return
  installActions()
  setOnSignedOut(() => {
    tokens.set('access'); tokens.set('refresh')
    useStore.setState({ admin: null, liveReady: false })
    toast.error('Your session has ended.', 'Please sign in again.')
  })
  setOnTeamSignedOut(() => {
    const was = !!get().teamUser
    set({ teamUser: null })
    if (was) toast.error('Your team session has ended.', 'Please sign in again.')
  })
  void loadPublic().catch(showLoadError)
  if (tokens.get('access') && get().admin) void syncAdmin().catch(showLoadError)
  else set({ admin: null })
}
