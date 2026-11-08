import type { Activity, AppNotification, Assignment, Duty, Member, MinistryEvent, Position, Zone } from './types'
import { AISLE_COUNT, DOORS, SECTION_COUNT, SPOTS, hasSpots, naveOf, sectionCell, type DoorKind } from './venue'

/* Deterministic RNG so every fresh install sees the same demo roster. */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MALE = ['Daniel', 'Samuel', 'David', 'Joshua', 'Michael', 'John', 'Emmanuel', 'Tunde', 'Chinedu', 'Ibrahim', 'Femi', 'Segun', 'Kelechi', 'Uche', 'Ayodele', 'Babatunde', 'Chukwuemeka', 'Obinna', 'Yusuf', 'Musa', 'Olumide', 'Kayode', 'Ifeanyi', 'Tobi', 'Seun', 'Dapo', 'Gbenga', 'Nnamdi', 'Chidi', 'Ebuka', 'Bayo', 'Kunle', 'Timothy', 'Stephen', 'Peter', 'Paul', 'Isaac', 'Elijah', 'Caleb', 'Victor', 'Godwin', 'Sunday', 'Ade', 'Damilare', 'Ikenna', 'Osas', 'Efosa', 'Aliyu', 'Bashir', 'Ope']
const FEMALE = ['Grace', 'Deborah', 'Faith', 'Peace', 'Victoria', 'Blessing', 'Esther', 'Ruth', 'Mercy', 'Joy', 'Funmi', 'Ngozi', 'Chiamaka', 'Adaeze', 'Aisha', 'Halima', 'Temitope', 'Bukola', 'Yetunde', 'Folake', 'Kemi', 'Tolu', 'Ifeoma', 'Chioma', 'Amaka', 'Nkechi', 'Zainab', 'Hauwa', 'Oluwaseun', 'Damilola', 'Precious', 'Favour', 'Gift', 'Patience', 'Comfort', 'Lydia', 'Hannah', 'Sarah', 'Rebecca', 'Abigail', 'Eunice', 'Rita', 'Ijeoma', 'Uju', 'Osaretin', 'Ese', 'Titilayo', 'Omolara', 'Kehinde', 'Taiwo']
const LAST = ['Adeyemi', 'Okafor', 'Emmanuel', 'Adebayo', 'Oche', 'Ibrahim', 'Adekunle', 'Eze', 'Danladi', 'James', 'Adewale', 'Okonkwo', 'Balogun', 'Nwosu', 'Ogunleye', 'Bello', 'Abubakar', 'Okeke', 'Olatunji', 'Akinola', 'Uzor', 'Chukwu', 'Afolabi', 'Odukoya', 'Mohammed', 'Usman', 'Ogundipe', 'Nwachukwu', 'Ilesanmi', 'Oyelaran', 'Fashola', 'Obi', 'Anyanwu', 'Ajayi', 'Oladipo', 'Igwe', 'Salami', 'Etim', 'Bassey', 'Akpan', 'Udoh', 'Edet', 'Osagie', 'Iyamu', 'Omoregie', 'Ehigiator', 'Lawal', 'Yakubu', 'Garba', 'Ogbonna', 'Onyeka', 'Ekwueme', 'Adeleke', 'Oyewole', 'Ojo', 'Akande', 'Babatunde', 'Ayodeji', 'Oni', 'Ige']
const PREFIX = ['0803', '0806', '0813', '0816', '0810', '0814', '0703', '0706', '0805', '0807', '0815', '0811', '0705', '0802', '0808', '0812', '0701', '0708', '0902', '0901', '0907', '0904', '0903', '0906', '0909', '0908']
const UNITS = ['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F']

type PosSpec = { name: string; required: number; duty: Duty; lead?: boolean }

export const AISLE_POSITIONS: PosSpec[] = [
  { name: 'Aisle Lead', required: 1, duty: 'lead', lead: true },
  { name: 'Crowd Control', required: 6, duty: 'crowd' },
  { name: 'Floor Marshal', required: 3, duty: 'crowd' },
]

/** Sections without usher seats get their own positions. */
const SPOTLESS_POSITIONS: Record<number, PosSpec> = {
  5: { name: 'Section Usher', required: 2, duty: 'protocol' },
  6: { name: 'Protocol Support', required: 3, duty: 'protocol' },
  7: { name: 'Section Usher', required: 2, duty: 'protocol' },
  17: { name: 'Tech Liaison', required: 1, duty: 'support' },
  18: { name: 'Media Liaison', required: 1, duty: 'support' },
}

const DOOR_POSITIONS: Record<DoorKind, PosSpec[]> = {
  aisle: [{ name: 'Door Usher', required: 2, duty: 'door' }, { name: 'Greeter', required: 1, duty: 'greeter' }],
  closed: [{ name: 'Door Usher', required: 1, duty: 'door' }],
  twoway: [{ name: 'Greeter', required: 4, duty: 'greeter' }, { name: 'Door Usher', required: 3, duty: 'door' }, { name: 'Crowd Control', required: 3, duty: 'crowd' }],
  workers: [{ name: 'Door Usher', required: 2, duty: 'door' }],
  access: [{ name: 'Door Usher', required: 2, duty: 'door' }],
}

/** Areas on the floor plan (mapRef) and off it (no mapRef: listed beside the map). */
export const AREA_ZONES: { name: string; ref?: string; positions: PosSpec[] }[] = [
  { name: 'Altar & Pulpit', ref: 'altar', positions: [{ name: 'Altar Protocol', required: 12, duty: 'protocol' }] },
  { name: 'Worship Team', ref: 'worship', positions: [{ name: 'Stage Support', required: 6, duty: 'support' }] },
  { name: "Apostle's Chairs", ref: 'apostle', positions: [{ name: 'Chair Protocol', required: 9, duty: 'protocol' }] },
  { name: 'Protocol Row', ref: 'protocol', positions: [{ name: 'Protocol Support', required: 6, duty: 'protocol' }] },
  { name: 'Technical Space', ref: 'tech', positions: [{ name: 'Tech Liaison', required: 3, duty: 'support' }] },
  { name: 'Covered Walkway', ref: 'walkway', positions: [{ name: 'Walkway Control', required: 4, duty: 'crowd' }] },
  { name: 'Main Gate', positions: [{ name: 'Greeter', required: 20, duty: 'greeter' }, { name: 'Crowd Control', required: 12, duty: 'crowd' }] },
  { name: 'Registration Area', positions: [{ name: 'Registration Desk', required: 24, duty: 'support' }] },
  { name: 'Car Park', positions: [{ name: 'Traffic Direction', required: 30, duty: 'crowd' }] },
  { name: 'Rotunda', positions: [{ name: "Ministers' Escort", required: 12, duty: 'protocol' }] },
  { name: 'Overflow', positions: [{ name: 'Overflow Seating', required: 30, duty: 'seat' }] },
  { name: 'First Aid Point', positions: [{ name: 'First Aid Support', required: 8, duty: 'support' }] },
]

/** Hand-picked members used in the demo flow and the brief's examples. */
const NAMED: [string, string, string, 'Male' | 'Female'][] = [
  ['Daniel', 'Adeyemi', '08031234567', 'Male'],
  ['John', 'Adewale', '08020001122', 'Male'],
  ['Samuel', 'Adeyemi', '08030004455', 'Male'],
  ['Grace', 'Emmanuel', '08050007788', 'Female'],
  ['Grace', 'Okafor', '08061230001', 'Female'],
  ['Samuel', 'Emmanuel', '08131230002', 'Male'],
  ['Deborah', 'Adebayo', '08161230003', 'Female'],
  ['David', 'Oche', '07031230004', 'Male'],
  ['Faith', 'Ibrahim', '08051112233', 'Female'],
  ['Joshua', 'Adekunle', '09031230006', 'Male'],
  ['Peace', 'Eze', '08101230007', 'Female'],
  ['Michael', 'Danladi', '08141230008', 'Male'],
  ['Victoria', 'James', '07061230009', 'Female'],
]

export interface SeedState {
  members: Member[]
  events: MinistryEvent[]
  zones: Zone[]
  positions: Position[]
  assignments: Assignment[]
  activity: Activity[]
  notifications: AppNotification[]
  activeEventId: string
}

export const DEMO = {
  found: '08031234567',
  unassigned: '08051112233',
  missing: '08099990000',
  coordinator: '08020001122',
  leader: '08141230008',
}

export const TGA_SERIES = 'TGA 2026'
export const TGA_VENUE = 'Koinonia Global Arena, Koinonia Drive, off Olusegun Obasanjo Way, Jabi District, Abuja'
const TGA_DAYS = ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']
export const SESSION_TIMES = {
  morning: { startTime: '08:45', reportingTime: '07:30', briefingTime: '08:00' },
  evening: { startTime: '17:00', reportingTime: '15:45', briefingTime: '16:15' },
} as const

export function createSeed(): SeedState {
  const rnd = mulberry32(20261118)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
  const now = Date.now()
  const ago = (mins: number) => new Date(now - mins * 60000).toISOString()

  /* ---------- members ---------- */
  const usedPhones = new Set<string>()
  const members: Member[] = []
  NAMED.forEach(([f, l, p, g], i) => {
    usedPhones.add(p)
    members.push({
      id: `m${i + 1}`, firstName: f, lastName: l, phone: p, gender: g,
      email: `${f}.${l}@mail.com`.toLowerCase(), memberId: `KGU-${String(1001 + i)}`,
      unit: UNITS[i % UNITS.length], status: 'active', joinedYear: 2016 + (i % 9),
    })
  })
  while (members.length < 1284) {
    const g: 'Male' | 'Female' = rnd() < 0.52 ? 'Female' : 'Male'
    const first = pick(g === 'Male' ? MALE : FEMALE)
    const last = pick(LAST)
    let phone = ''
    do phone = pick(PREFIX) + String(Math.floor(rnd() * 1e7)).padStart(7, '0')
    while (usedPhones.has(phone))
    usedPhones.add(phone)
    const i = members.length
    members.push({
      id: `m${i + 1}`, firstName: first, lastName: last, phone, gender: g,
      email: rnd() < 0.7 ? `${first}.${last}${i % 97}@mail.com`.toLowerCase() : undefined,
      memberId: `KGU-${String(1001 + i)}`, unit: pick(UNITS),
      status: rnd() < 0.97 ? 'active' : 'inactive', joinedYear: 2014 + Math.floor(rnd() * 12),
    })
  }
  const byId = new Map(members.map((m) => [m.id, m]))

  /* ---------- leaders and coordinators ---------- */
  const LEADERS: Record<string, string> = { 'Nave C': 'm8', 'Nave B': 'm12', 'Nave A': 'm11', Doors: 'm13' }
  Object.values(LEADERS).forEach((id) => (byId.get(id)!.role = 'leader'))
  const groups: { names: string[]; leader: string; who?: string }[] = []
  for (const nave of ['Nave C', 'Nave B', 'Nave A']) {
    for (let col = 0; col < 7; col++) {
      const secs: number[] = []
      for (let n = 1; n <= SECTION_COUNT; n++) if (sectionCell(n).col === col && naveOf(n) === nave) secs.push(n)
      groups.push({ names: secs.map((n) => `Section ${n}`), leader: LEADERS[nave], who: nave === 'Nave B' && col === 3 ? 'm2' : undefined })
    }
  }
  groups.push({ names: ['Aisle 1', 'Aisle 2', 'Aisle 3'], leader: LEADERS['Nave C'] })
  groups.push({ names: ['Aisle 4', 'Aisle 5', 'Aisle 6'], leader: LEADERS['Nave B'] })
  groups.push({ names: ['Aisle 7', 'Aisle 8', 'Aisle 9'], leader: LEADERS['Nave A'] })
  groups.push({ names: ['Altar & Pulpit', "Apostle's Chairs", 'Protocol Row', 'Worship Team', 'Technical Space'], leader: LEADERS['Nave B'], who: 'm10' })
  groups.push({ names: ['Door X3', 'Door X4', 'Door X5', 'Main Gate'], leader: LEADERS.Doors, who: 'm7' })
  groups.push({ names: DOORS.filter((d) => d.ref.startsWith('D')).map((d) => `Door ${d.ref}`), leader: LEADERS.Doors, who: 'm5' })
  groups.push({ names: ['Door X1', 'Door X2', 'Door M1', 'Door M2', 'Door M3', 'Covered Walkway', 'Rotunda'], leader: LEADERS.Doors })
  groups.push({ names: ['Registration Area', 'Car Park', 'Overflow', 'First Aid Point'], leader: LEADERS.Doors })
  let ci = 13
  for (const g of groups) {
    let id = g.who
    if (!id) {
      do id = `m${++ci + 20}`
      while (byId.get(id)!.status !== 'active' || byId.get(id)!.role)
    }
    Object.assign(byId.get(id)!, { role: 'coordinator', leaderId: g.leader, coordinates: g.names })
  }

  /* ---------- events: TGA is one event per session ---------- */
  const events: MinistryEvent[] = []
  TGA_DAYS.forEach((date, d) => {
    for (const session of ['morning', 'evening'] as const) {
      const t = SESSION_TIMES[session]
      const published = d < 2
      events.push({
        id: `ev_tga26_d${d + 1}${session === 'morning' ? 'am' : 'pm'}`,
        name: 'The General Assembly 2026',
        code: `TGA D${d + 1} ${session === 'morning' ? 'AM' : 'PM'}`,
        series: TGA_SERIES, day: d + 1, session,
        theme: 'More Than Conquerors (Romans 8:37)',
        description: `Day ${d + 1}, ${session} session. Full department deployment across the arena, doors and grounds.`,
        date, venue: TGA_VENUE, ...t,
        dressCode: session === 'morning' ? 'Departmental Uniform' : 'White top, black bottom, department tag',
        status: 'active', rosterStatus: published ? 'published' : 'draft', publishedAt: published ? ago(60 * 26) : undefined,
        instructions: `Report by ${session === 'morning' ? '7:30 AM' : '3:45 PM'} for the department briefing. Collect your tag from your section coordinator. If you can’t make this session, tell us here so your seat can be covered.`,
      })
    }
  })
  events.push(
    {
      id: 'ev_ms_oct', name: 'Miracle Service: October', code: 'MS OCT', session: 'morning', startTime: '09:00',
      description: 'Monthly miracle service. Reduced deployment, main hall and doors only.',
      date: '2026-10-25', venue: TGA_VENUE, reportingTime: '07:00', briefingTime: '07:30',
      dressCode: 'White top, black bottom', status: 'completed', rosterStatus: 'published', publishedAt: '2026-10-20T10:00:00.000Z',
    },
    {
      id: 'ev_sor26', name: 'SOR 2026', code: 'SOR 2026', session: 'evening', startTime: '17:00',
      description: 'Year-end programme. Roster in preparation.',
      date: '2026-12-12', venue: TGA_VENUE, reportingTime: '14:00', briefingTime: '14:30',
      dressCode: 'Departmental Uniform', status: 'draft', rosterStatus: 'draft',
    },
  )

  /* ---------- zones + positions (cloned per event) ---------- */
  const zones: Zone[] = []
  const positions: Position[] = []
  for (const ev of events) {
    let order = 0
    const zone = (key: string, name: string, kind: Zone['kind'], mapRef?: string) => {
      const z: Zone = { id: `${ev.id}_${key}`, name, eventId: ev.id, kind, order: order++, mapRef }
      zones.push(z)
      return z
    }
    const addPos = (z: Zone, list: PosSpec[]) =>
      list.forEach((p, i) => positions.push({ id: `${z.id}_p${i}`, name: p.name, zoneId: z.id, order: i, isLeadRole: p.lead, required: p.required, duty: p.duty }))
    for (let a = 1; a <= AISLE_COUNT; a++) addPos(zone(`a${a}`, `Aisle ${a}`, 'aisle', `A${a}`), AISLE_POSITIONS)
    for (let n = 1; n <= SECTION_COUNT; n++) {
      const z = zone(`s${n}`, `Section ${n}`, 'section', `S${n}`)
      if (hasSpots(n))
        SPOTS.forEach((sp, i) => positions.push({ id: `${z.id}_${sp.key}`, name: sp.name, zoneId: z.id, order: i, required: 1, spot: sp.key, duty: 'seat' }))
      else addPos(z, [SPOTLESS_POSITIONS[n]])
    }
    for (const d of DOORS) addPos(zone(`d${d.ref}`, `Door ${d.ref}`, 'door', d.ref), DOOR_POSITIONS[d.kind])
    AREA_ZONES.forEach((ar, i) => addPos(zone(`z${i}`, ar.name, 'area', ar.ref), ar.positions))
  }
  const posById = new Map(positions.map((p) => [p.id, p]))

  /* ---------- assignments ---------- */
  const assignments: Assignment[] = []
  let aCount = 0
  const add = (memberId: string, eventId: string, positionId: string, isTeamLead = false, status: Assignment['status'] = 'confirmed', unavailableReason?: string) => {
    const pos = posById.get(positionId)!
    assignments.push({ id: `as${++aCount}`, memberId, eventId, zoneId: pos.zoneId, positionId, isTeamLead, status, unavailableReason, updatedAt: ago(60 * 24 + (aCount % 900)) })
  }
  const posOf = (eventId: string, zoneName: string, posName: string) => {
    const z = zones.find((z) => z.eventId === eventId && z.name === zoneName)!
    return positions.find((p) => p.zoneId === z.id && p.name === posName)!.id
  }

  const D1AM = 'ev_tga26_d1am'
  // the demo flow: Daniel stands at Section 41; Grace can't make Day 1 morning
  add('m1', D1AM, posOf(D1AM, 'Section 41', 'Front row, left end'))
  add('m6', D1AM, posOf(D1AM, 'Section 41', 'Back row, left end'), true)
  add('m3', D1AM, posOf(D1AM, 'Section 41', 'Front row, right end'))
  add('m4', D1AM, posOf(D1AM, 'Section 41', 'Back row, right end'), false, 'unavailable', 'Travelling back on Wednesday afternoon')

  const fill: Record<string, number> = {
    'Aisle 1': 0.9, 'Aisle 7': 0.8, 'Aisle 9': 0.9,
    Overflow: 0.6, 'Car Park': 0.7, 'First Aid Point': 0.75, 'Registration Area': 0.8, 'Door X2': 0.5, 'Door D7': 0.5,
  }
  const shortSections = [72, 73, 74, 83, 82, 81, 60, 61, 71, 70, 59, 47, 52, 36, 43, 29, 64, 66, 55]
  shortSections.forEach((n, i) => (fill[`Section ${n}`] = [0.5, 0.75, 0.5, 0.75, 0.25][i % 5]))
  const reserved = new Set(['m1', 'm3', 'm4', 'm6', 'm9'])
  const pool = members.filter((m) => m.status === 'active' && !m.role && !reserved.has(m.id))
  let poolIdx = 0
  const evZones = (id: string) => zones.filter((z) => z.eventId === id)
  for (const z of evZones(D1AM)) {
    for (const p of positions.filter((p) => p.zoneId === z.id)) {
      const want = p.spot ? (rnd() < (fill[z.name] ?? 0.96) ? 1 : 0) : Math.round((p.required ?? 0) * (fill[z.name] ?? 0.97))
      let have = assignments.filter((a) => a.positionId === p.id).length
      while (have < want && poolIdx < pool.length) {
        add(pool[poolIdx++].id, D1AM, p.id, !!p.isLeadRole && have === 0, rnd() < 0.8 ? 'confirmed' : 'assigned')
        have++
      }
    }
  }
  const spare = pool.slice(poolIdx)

  /** Later sessions keep most of Day 1 morning's team in the same places, with some changes. */
  const copySession = (to: string, keep: number, status: () => Assignment['status']) => {
    const used = new Set<string>()
    const src = assignments.filter((a) => a.eventId === D1AM && !['m1', 'm3', 'm4', 'm6'].includes(a.memberId))
    for (const a of src) {
      const pid = a.positionId.replace(D1AM, to)
      if (rnd() < keep) { add(a.memberId, to, pid, a.isTeamLead, status()); used.add(a.memberId) }
      else if (rnd() < 0.7) {
        const m = spare.find((x) => !used.has(x.id))
        if (m) { add(m.id, to, pid, a.isTeamLead, status()); used.add(m.id) }
      }
    }
  }
  const st = (confirmed: number) => () => (rnd() < confirmed ? 'confirmed' : 'assigned') as Assignment['status']
  copySession('ev_tga26_d1pm', 0.9, st(0.72))
  copySession('ev_tga26_d2am', 0.88, st(0.55))
  copySession('ev_tga26_d2pm', 0.86, st(0.45))
  copySession('ev_tga26_d3am', 0.6, () => 'assigned')

  // Daniel's other sessions
  add('m1', 'ev_tga26_d1pm', posOf('ev_tga26_d1pm', 'Door X4', 'Greeter'))
  add('m4', 'ev_tga26_d1pm', posOf('ev_tga26_d1pm', 'Section 41', 'Back row, right end'), false, 'assigned')
  add('m3', 'ev_tga26_d1pm', posOf('ev_tga26_d1pm', 'Section 41', 'Front row, right end'))
  add('m1', 'ev_tga26_d2am', posOf('ev_tga26_d2am', 'Section 41', 'Front row, left end'), false, 'assigned')
  add('m3', 'ev_tga26_d2am', posOf('ev_tga26_d2am', 'Section 41', 'Front row, right end'), false, 'assigned')
  add('m1', 'ev_tga26_d3am', posOf('ev_tga26_d3am', 'Section 41', 'Front row, left end'), false, 'assigned')
  // keep one usher per spot after the copies
  const seen = new Set<string>()
  for (let i = assignments.length - 1; i >= 0; i--) {
    const a = assignments[i]
    if (!posById.get(a.positionId)?.spot) continue
    const k = a.positionId
    if (seen.has(k)) assignments.splice(i, 1)
    else seen.add(k)
  }

  // a few more people who can't make it, so the cover list has something in it
  const REASONS = ['Work shift', 'Travelling', 'Unwell', 'Family event', 'Exams']
  const mark = (eventId: string, count: number) => {
    const list = assignments.filter((a) => a.eventId === eventId && a.status !== 'unavailable' && !a.isTeamLead && a.memberId !== 'm1')
    for (let i = 0; i < count; i++) {
      const a = list[Math.floor(rnd() * list.length)]
      a.status = 'unavailable'
      a.unavailableReason = pick(REASONS)
    }
  }
  mark(D1AM, 7)
  mark('ev_tga26_d1pm', 5)
  mark('ev_tga26_d2am', 3)

  // smaller rosters for the other events
  const smallRoster = (evId: string, count: number, status: Assignment['status']) => {
    const evZ = evZones(evId).filter((z) => z.kind === 'aisle' || z.kind === 'door' || ['Main Gate', 'Car Park'].includes(z.name))
    const evPos = positions.filter((p) => evZ.some((z) => z.id === p.zoneId))
    const slots = evPos.flatMap((p) => Array<Position>(p.required ?? 1).fill(p))
    const shuffled = pool.slice().sort(() => rnd() - 0.5)
    shuffled.slice(0, Math.min(count, slots.length)).forEach((m, k) => {
      const p = slots[k]
      add(m.id, evId, p.id, !!p.isLeadRole && !assignments.some((a) => a.positionId === p.id), status)
    })
  }
  add('m1', 'ev_ms_oct', posOf('ev_ms_oct', 'Main Gate', 'Greeter'))
  smallRoster('ev_ms_oct', 160, 'confirmed')
  smallRoster('ev_sor26', 90, 'assigned')

  /* ---------- activity + notifications ---------- */
  const d1 = assignments.filter((a) => a.eventId === D1AM)
  const away = d1.filter((a) => a.status === 'unavailable').length
  const activity: Activity[] = [
    { id: 'ac0', actor: 'Grace Emmanuel', text: "said she can't make TGA Day 1 morning (Section 41)", at: ago(9), kind: 'absence' },
    { id: 'ac1', actor: 'Daniel', text: 'assigned 12 ushers to Aisle 4 for TGA D1 AM', at: ago(14), kind: 'assign' },
    { id: 'ac2', actor: 'Grace', text: 'set the evening reporting time for TGA to 3:45 PM', at: ago(52), kind: 'event' },
    { id: 'ac3', actor: 'Admin', text: 'imported 56 members from members-nov.csv', at: ago(60 * 3), kind: 'import' },
    { id: 'ac4', actor: 'Admin', text: 'gave John Adewale Sections 40 to 43', at: ago(60 * 7), kind: 'team' },
    { id: 'ac5', actor: 'Admin', text: 'published the TGA Day 1 and Day 2 rosters', at: ago(60 * 26), kind: 'publish' },
    { id: 'ac6', actor: 'Samuel', text: 'moved 4 greeters from the Main Gate to Door X3', at: ago(60 * 30), kind: 'assign' },
  ]
  const notifications: AppNotification[] = [
    { id: 'n1', title: 'Ushers who can’t make it', body: `${away} ushers said they can’t make TGA Day 1 morning. Their spots are open for cover.`, at: ago(9), tone: 'warn', read: false },
    { id: 'n2', title: 'TGA starts in 10 days', body: 'The General Assembly runs 18 to 22 November, mornings at 8:45 AM and evenings at 5:00 PM.', at: ago(60 * 2), tone: 'info', read: false },
    { id: 'n3', title: 'Import completed', body: '56 members imported. 2 rows skipped for duplicate phone numbers.', at: ago(60 * 3), tone: 'success', read: false },
    { id: 'n4', title: 'Roster published', body: 'TGA Day 1 and Day 2 assignments are now visible to ushers.', at: ago(60 * 26), tone: 'success', read: true },
  ]

  return { members, events, zones, positions, assignments, activity, notifications, activeEventId: D1AM }
}

export type { Duty }
