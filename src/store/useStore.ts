import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { Activity, AdminRole, AppNotification, Assignment, Member, MemberRole, MinistryEvent, Position, Zone, ZoneKind } from '@/data/types'
import { createSeed } from '@/data/mock'
import { eventLabel, normalizePhone, uid } from '@/lib/utils'
import { LIVE } from '@/lib/api'

const safeStorage: StateStorage = {
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* storage full or blocked: keep working in memory */ } },
  removeItem: (k) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
}

export interface AssignInput {
  memberId: string
  eventId: string
  zoneId: string
  positionId: string
  isTeamLead?: boolean
}

export interface ImportRow {
  firstName: string
  lastName: string
  phone: string
  email?: string
  gender?: 'Male' | 'Female'
  unit?: string
  zone?: string
  position?: string
}

interface State {
  members: Member[]
  events: MinistryEvent[]
  zones: Zone[]
  positions: Position[]
  assignments: Assignment[]
  activity: Activity[]
  notifications: AppNotification[]
  activeEventId: string
  admin: { id?: string; name: string; email: string; role?: AdminRole } | null
  /** a coordinator or leader signed in to their team view */
  teamUser: { memberId: string } | null
  /** live mode: signed in to the team page, but the server has no current session */
  teamNoSession?: boolean
  /** live mode: the admin's data has finished its first load */
  liveReady: boolean
  /** live mode: "ushers serving" on the landing page */
  publicAssigned?: number
  settings: { contactPhone: string; contactName: string; showTeammatePhones: boolean; allowSelfConfirm: boolean }

  login: (email: string, remember: boolean) => void
  logout: () => void
  teamLogin: (phone: string) => 'ok' | 'not-found' | 'not-team'
  teamLogout: () => void
  setTeamRole: (memberId: string, role: MemberRole, opts?: { leaderId?: string; leaderIds?: string[]; coordinates?: string[] }) => void
  setActiveEvent: (id: string) => void
  log: (text: string, kind: Activity['kind']) => void
  notify: (n: Omit<AppNotification, 'id' | 'at' | 'read'>) => void
  markNotificationsRead: () => void

  createEvent: (e: Omit<MinistryEvent, 'id'>) => string
  updateEvent: (id: string, patch: Partial<MinistryEvent>) => void
  duplicateEvent: (id: string) => string
  archiveEvent: (id: string) => void
  deleteEvent: (id: string) => void
  setRosterStatus: (id: string, status: MinistryEvent['rosterStatus']) => void

  addMember: (m: Omit<Member, 'id'>) => string
  updateMember: (id: string, patch: Partial<Member>) => void
  deleteMembers: (ids: string[]) => void
  importRows: (rows: ImportRow[], eventId: string) => { members: number; assignments: number }

  assign: (a: AssignInput) => void
  removeAssignment: (id: string) => void
  removeAssignmentsFor: (memberIds: string[], eventId: string) => number
  bulkAssign: (memberIds: string[], eventId: string, zoneId: string, positionId: string) => number
  moveToEvent: (memberIds: string[], fromEventId: string, toEventId: string) => number
  confirmAssignment: (id: string) => void
  /** the usher can't make this session: the assignment stays on record but the spot opens for cover */
  markUnavailable: (id: string, reason?: string) => void
  undoUnavailable: (id: string) => boolean
  copyRoster: (fromEventId: string, toEventId: string) => number

  addZone: (eventId: string, name: string, kind: ZoneKind) => string
  renameZone: (id: string, name: string) => void
  deleteZone: (id: string) => void
  addPosition: (zoneId: string, name: string, required?: number) => void
  updatePosition: (id: string, patch: Partial<Position>) => void
  deletePosition: (id: string) => void
  reorderPositions: (zoneId: string, orderedIds: string[]) => void

  updateSettings: (patch: Partial<State['settings']>) => void
  resetDemo: () => void
}

const seed = () => {
  // with a backend connected the store starts empty and is filled from the API
  const s = LIVE
    ? { members: [], events: [], zones: [], positions: [], assignments: [], activity: [], notifications: [], activeEventId: '' }
    : createSeed()
  return {
    ...s,
    admin: null,
    teamUser: null,
    liveReady: false,
    settings: { contactPhone: '08020009988', contactName: 'Department Secretariat', showTeammatePhones: true, allowSelfConfirm: true },
  }
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...seed(),

      login: (email) => {
        const local = email.split('@')[0] || 'admin'
        const name = local.charAt(0).toUpperCase() + local.slice(1).replace(/[._-].*/, '')
        set({ admin: { name, email, role: 'admin' } })
      },
      logout: () => set({ admin: null }),
      teamLogin: (phone) => {
        const p = normalizePhone(phone)
        const m = get().members.find((x) => x.phone === p)
        if (!m) return 'not-found'
        if (m.status === 'inactive' || (m.role !== 'coordinator' && m.role !== 'leader')) return 'not-team'
        set({ teamUser: { memberId: m.id } })
        return 'ok'
      },
      teamLogout: () => set({ teamUser: null }),
      setTeamRole: (memberId, role, opts = {}) => {
        set((s) => ({
          members: s.members.map((m) => {
            if (m.id === memberId) {
              if (role === 'usher') return { ...m, role: undefined, leaderId: undefined, leaderIds: undefined, coordinates: undefined }
              if (role === 'leader') return { ...m, role, leaderId: undefined, leaderIds: undefined, coordinates: undefined }
              const leaderIds = opts.leaderIds ?? (opts.leaderId ? [opts.leaderId] : [])
              return { ...m, role, leaderId: leaderIds[0], leaderIds, coordinates: opts.coordinates ?? m.coordinates ?? [] }
            }
            // a leader who steps down is removed from their coordinators' leader links
            if (role !== 'leader' && (m.leaderId === memberId || m.leaderIds?.includes(memberId))) {
              const nextIds = (m.leaderIds ?? (m.leaderId ? [m.leaderId] : [])).filter((id) => id !== memberId)
              return { ...m, leaderId: nextIds[0], leaderIds: nextIds.length ? nextIds : undefined }
            }
            return m
          }),
        }))
        const m = get().members.find((x) => x.id === memberId)
        if (m) get().log(role === 'usher' ? `removed ${m.firstName} ${m.lastName} from the team structure` : `set ${m.firstName} ${m.lastName} as a ${role}`, 'team')
      },
      setActiveEvent: (id) => set({ activeEventId: id }),
      log: (text, kind) =>
        set((s) => ({ activity: [{ id: uid('ac'), actor: s.admin?.name ?? 'Admin', text, at: new Date().toISOString(), kind }, ...s.activity].slice(0, 60) })),
      notify: (n) => set((s) => ({ notifications: [{ ...n, id: uid('n'), at: new Date().toISOString(), read: false }, ...s.notifications].slice(0, 40) })),
      markNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      createEvent: (e) => {
        const id = uid('ev')
        // new events inherit the working structure of the current active event
        const template = get().zones.filter((z) => z.eventId === get().activeEventId)
        const zones: Zone[] = []
        const positions: Position[] = []
        template.forEach((z) => {
          const nz = { ...z, id: uid('z'), eventId: id }
          zones.push(nz)
          get().positions.filter((p) => p.zoneId === z.id).forEach((p) => positions.push({ ...p, id: uid('p'), zoneId: nz.id }))
        })
        set((s) => ({ events: [{ ...e, id }, ...s.events], zones: [...s.zones, ...zones], positions: [...s.positions, ...positions] }))
        get().log(`created ${e.code}${e.status === 'draft' ? ' as a draft' : ''}`, 'event')
        return id
      },
      updateEvent: (id, patch) => {
        set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
        const e = get().events.find((x) => x.id === id)
        if (e) get().log(`updated ${e.code}`, 'event')
      },
      duplicateEvent: (id) => {
        const src = get().events.find((e) => e.id === id)!
        const prev = get().activeEventId
        set({ activeEventId: id })
        const newId = get().createEvent({ ...src, name: `${src.name} (Copy)`, code: `${src.code} COPY`, status: 'draft', rosterStatus: 'draft', publishedAt: undefined })
        set({ activeEventId: prev })
        return newId
      },
      archiveEvent: (id) => {
        set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, status: 'archived', rosterStatus: 'draft' } : e)) }))
        get().log(`archived ${get().events.find((e) => e.id === id)?.code}`, 'event')
      },
      deleteEvent: (id) => {
        const code = get().events.find((e) => e.id === id)?.code
        set((s) => {
          const zoneIds = new Set(s.zones.filter((z) => z.eventId === id).map((z) => z.id))
          const events = s.events.filter((e) => e.id !== id)
          return {
            events,
            zones: s.zones.filter((z) => !zoneIds.has(z.id)),
            positions: s.positions.filter((p) => !zoneIds.has(p.zoneId)),
            assignments: s.assignments.filter((a) => a.eventId !== id),
            activeEventId: s.activeEventId === id ? events[0]?.id ?? '' : s.activeEventId,
          }
        })
        get().log(`deleted ${code}`, 'event')
      },
      setRosterStatus: (id, status) => {
        set((s) => ({
          events: s.events.map((e) =>
            e.id === id ? { ...e, rosterStatus: status, publishedAt: status === 'published' ? new Date().toISOString() : e.publishedAt, status: status === 'published' && e.status === 'draft' ? 'active' : e.status } : e),
        }))
        const e = get().events.find((x) => x.id === id)!
        get().log(status === 'published' ? `published the ${e.code} roster` : `moved the ${e.code} roster back to draft`, 'publish')
        get().notify({ title: status === 'published' ? 'Roster published' : 'Roster unpublished', body: `${e.code} assignments are ${status === 'published' ? 'now visible to ushers' : 'hidden from ushers'}.`, tone: status === 'published' ? 'success' : 'info' })
      },

      addMember: (m) => {
        const id = uid('m')
        set((s) => ({ members: [{ ...m, id }, ...s.members] }))
        get().log(`added ${m.firstName} ${m.lastName} to members`, 'member')
        return id
      },
      updateMember: (id, patch) => set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      deleteMembers: (ids) => {
        const set_ = new Set(ids)
        set((s) => ({ members: s.members.filter((m) => !set_.has(m.id)), assignments: s.assignments.filter((a) => !set_.has(a.memberId)) }))
        get().log(`deleted ${ids.length} member${ids.length === 1 ? '' : 's'}`, 'member')
      },
      importRows: (rows, eventId) => {
        const s = get()
        const newMembers: Member[] = []
        const newAssignments: Assignment[] = []
        const evZones = s.zones.filter((z) => z.eventId === eventId)
        let n = s.members.length
        rows.forEach((r) => {
          const id = uid('m')
          newMembers.push({ id, firstName: r.firstName, lastName: r.lastName, phone: r.phone, email: r.email, gender: r.gender, unit: r.unit, status: 'active', memberId: `KGU-${1001 + n++}`, joinedYear: new Date().getFullYear() })
          if (r.zone && r.position) {
            const z = evZones.find((z) => z.name.toLowerCase() === r.zone!.toLowerCase())
            const p = z && s.positions.find((p) => p.zoneId === z.id && p.name.toLowerCase() === r.position!.toLowerCase())
            if (z && p) newAssignments.push({ id: uid('as'), memberId: id, eventId, zoneId: z.id, positionId: p.id, isTeamLead: false, status: 'assigned', updatedAt: new Date().toISOString() })
          }
        })
        set((st) => ({ members: [...newMembers, ...st.members], assignments: [...st.assignments, ...newAssignments] }))
        get().log(`imported ${newMembers.length} members${newAssignments.length ? ` with ${newAssignments.length} assignments` : ''}`, 'import')
        get().notify({ title: 'Import completed', body: `${newMembers.length} members imported${newAssignments.length ? `, ${newAssignments.length} assigned` : ''}.`, tone: 'success' })
        return { members: newMembers.length, assignments: newAssignments.length }
      },

      assign: ({ memberId, eventId, zoneId, positionId, isTeamLead = false }) => {
        set((s) => {
          // an usher spot holds one person, so whoever stood there is moved off it
          const onSpot = !!s.positions.find((p) => p.id === positionId)?.spot
          let assignments = s.assignments.filter((a) => !(a.eventId === eventId && (a.memberId === memberId || (onSpot && a.positionId === positionId))))
          if (isTeamLead) assignments = assignments.map((a) => (a.zoneId === zoneId && a.isTeamLead ? { ...a, isTeamLead: false } : a))
          return { assignments: [...assignments, { id: uid('as'), memberId, eventId, zoneId, positionId, isTeamLead, status: 'assigned', updatedAt: new Date().toISOString() }] }
        })
        const s = get()
        const m = s.members.find((x) => x.id === memberId)
        const z = s.zones.find((x) => x.id === zoneId)
        const p = s.positions.find((x) => x.id === positionId)
        s.log(`assigned ${m?.firstName} ${m?.lastName} to ${z?.name} · ${p?.name}`, 'assign')
      },
      removeAssignment: (id) => {
        const a = get().assignments.find((x) => x.id === id)
        set((s) => ({ assignments: s.assignments.filter((x) => x.id !== id) }))
        const m = a && get().members.find((x) => x.id === a.memberId)
        if (m) get().log(`removed ${m.firstName} ${m.lastName}'s assignment`, 'assign')
      },
      removeAssignmentsFor: (memberIds, eventId) => {
        const ids = new Set(memberIds)
        const before = get().assignments.length
        set((s) => ({ assignments: s.assignments.filter((a) => !(a.eventId === eventId && ids.has(a.memberId))) }))
        const n = before - get().assignments.length
        if (n) get().log(`removed ${n} assignment${n === 1 ? '' : 's'}`, 'assign')
        return n
      },
      bulkAssign: (memberIds, eventId, zoneId, positionId) => {
        const ids = new Set(memberIds)
        const now = new Date().toISOString()
        set((s) => ({
          assignments: [
            ...s.assignments.filter((a) => !(a.eventId === eventId && ids.has(a.memberId))),
            ...memberIds.map((memberId) => ({ id: uid('as'), memberId, eventId, zoneId, positionId, isTeamLead: false, status: 'assigned' as const, updatedAt: now })),
          ],
        }))
        const z = get().zones.find((x) => x.id === zoneId)
        get().log(`assigned ${memberIds.length} ushers to ${z?.name}`, 'assign')
        return memberIds.length
      },
      moveToEvent: (memberIds, fromEventId, toEventId) => {
        const s = get()
        const ids = new Set(memberIds)
        const moving = s.assignments.filter((a) => a.eventId === fromEventId && ids.has(a.memberId))
        const out: Assignment[] = []
        moving.forEach((a) => {
          const z = s.zones.find((z) => z.id === a.zoneId)
          const p = s.positions.find((p) => p.id === a.positionId)
          const tz = s.zones.find((x) => x.eventId === toEventId && x.name === z?.name)
          const tp = tz && s.positions.find((x) => x.zoneId === tz.id && x.name === p?.name)
          if (tz && tp) out.push({ ...a, id: uid('as'), eventId: toEventId, zoneId: tz.id, positionId: tp.id, status: 'assigned', unavailableReason: undefined, updatedAt: new Date().toISOString() })
        })
        const outIds = new Set(out.map((a) => a.memberId))
        const spotIds = new Set(out.filter((a) => s.positions.find((p) => p.id === a.positionId)?.spot).map((a) => a.positionId))
        set((st) => ({ assignments: [...st.assignments.filter((a) => !(a.eventId === toEventId && (outIds.has(a.memberId) || spotIds.has(a.positionId)))), ...out] }))
        const to = s.events.find((e) => e.id === toEventId)
        s.log(`copied ${out.length} assignments to ${to ? eventLabel(to) : 'another event'}`, 'assign')
        return out.length
      },
      confirmAssignment: (id) => set((s) => ({ assignments: s.assignments.map((a) => (a.id === id ? { ...a, status: 'confirmed' } : a)) })),
      markUnavailable: (id, reason) => {
        set((s) => ({ assignments: s.assignments.map((a) => (a.id === id ? { ...a, status: 'unavailable', unavailableReason: reason?.trim() || undefined, isTeamLead: false, updatedAt: new Date().toISOString() } : a)) }))
        const s = get()
        const a = s.assignments.find((x) => x.id === id)
        const m = a && s.members.find((x) => x.id === a.memberId)
        const e = a && s.events.find((x) => x.id === a.eventId)
        const z = a && s.zones.find((x) => x.id === a.zoneId)
        if (m && e && z) {
          set((st) => ({ activity: [{ id: uid('ac'), actor: `${m.firstName} ${m.lastName}`, text: `can't make ${eventLabel(e)} (${z.name})`, at: new Date().toISOString(), kind: 'absence' as const }, ...st.activity].slice(0, 60) }))
          s.notify({ title: 'Spot needs cover', body: `${m.firstName} ${m.lastName} can't make ${eventLabel(e)}. ${z.name} needs someone.`, tone: 'warn' })
        }
      },
      undoUnavailable: (id) => {
        const s = get()
        const a = s.assignments.find((x) => x.id === id)
        if (!a || a.status !== 'unavailable') return false
        // if someone already covers the spot, the usher can't take it back
        const spot = s.positions.find((p) => p.id === a.positionId)?.spot
        if (spot && s.assignments.some((x) => x.id !== id && x.positionId === a.positionId && x.status !== 'unavailable')) return false
        set((st) => ({ assignments: st.assignments.map((x) => (x.id === id ? { ...x, status: 'assigned', unavailableReason: undefined, updatedAt: new Date().toISOString() } : x)) }))
        return true
      },
      copyRoster: (fromEventId, toEventId) => {
        const ids = [...new Set(get().assignments.filter((a) => a.eventId === fromEventId).map((a) => a.memberId))]
        return get().moveToEvent(ids, fromEventId, toEventId)
      },

      addZone: (eventId, name, kind) => {
        const id = uid('z')
        const order = Math.max(-1, ...get().zones.filter((z) => z.eventId === eventId).map((z) => z.order)) + 1
        set((s) => ({ zones: [...s.zones, { id, name, eventId, kind, order }] }))
        get().log(`added ${name} to ${get().events.find((e) => e.id === eventId)?.code} positions`, 'position')
        return id
      },
      renameZone: (id, name) => set((s) => ({ zones: s.zones.map((z) => (z.id === id ? { ...z, name } : z)) })),
      deleteZone: (id) => {
        const z = get().zones.find((x) => x.id === id)
        set((s) => ({ zones: s.zones.filter((x) => x.id !== id), positions: s.positions.filter((p) => p.zoneId !== id), assignments: s.assignments.filter((a) => a.zoneId !== id) }))
        if (z) get().log(`deleted the ${z.name} zone`, 'position')
      },
      addPosition: (zoneId, name, required = 4) => {
        const order = Math.max(-1, ...get().positions.filter((p) => p.zoneId === zoneId).map((p) => p.order)) + 1
        set((s) => ({ positions: [...s.positions, { id: uid('p'), name, zoneId, order, required }] }))
      },
      updatePosition: (id, patch) => set((s) => ({ positions: s.positions.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deletePosition: (id) => set((s) => ({ positions: s.positions.filter((p) => p.id !== id), assignments: s.assignments.filter((a) => a.positionId !== id) })),
      reorderPositions: (_zoneId, orderedIds) =>
        set((s) => ({ positions: s.positions.map((p) => (orderedIds.includes(p.id) ? { ...p, order: orderedIds.indexOf(p.id) } : p)) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetDemo: () => set({ ...seed(), admin: get().admin, teamUser: null }),
    }),
    LIVE
      ? { name: 'grm-live-v1', storage: createJSONStorage(() => safeStorage), version: 1, partialize: (s) => ({ admin: s.admin }) as unknown as State }
      : { name: 'grm-store-v4', storage: createJSONStorage(() => safeStorage), version: 1 },
  ),
)
