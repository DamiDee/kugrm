import type { Activity, AppNotification, Assignment, Member, MinistryEvent, Position, Zone } from './types'
import { AISLE_COUNT, DOORS, MEDIA_SECTION, SECTION_COUNT, SPOTS, hasSpots } from './venue'

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

export const AISLE_POSITIONS: { name: string; required: number; lead?: boolean }[] = [
  { name: 'Aisle Lead', required: 1, lead: true },
  { name: 'Control 1', required: 6 },
  { name: 'Control 2', required: 6 },
  { name: 'Floor Marshal', required: 30 },
]

/** Sections without usher spots (front column and media) get floor ushers instead. */
export const SPOTLESS_SECTION_POSITION = { name: 'Section Usher', required: 2 }

const DOOR_REQUIRED = { entrance: 16, exit: 10, access: 8 } as const

/** Areas on the floor plan (mapRef) and off it (no mapRef: listed beside the map). */
export const AREA_ZONES: { name: string; ref?: string; position: string; required: number }[] = [
  { name: 'Altar & Pulpit', ref: 'altar', position: 'Altar Protocol', required: 16 },
  { name: 'Worship Team', ref: 'worship', position: 'Stage Support', required: 10 },
  { name: "Apostle's Chairs", ref: 'apostle', position: 'Chair Protocol', required: 9 },
  { name: 'Protocol Row', ref: 'protocol', position: 'Protocol Support', required: 12 },
  { name: 'Technical Space', ref: 'tech', position: 'Tech Liaison', required: 4 },
  { name: 'Covered Walkway', ref: 'walkway', position: 'Walkway Control', required: 6 },
  { name: 'Main Gate', position: 'Welcome & Direction', required: 40 },
  { name: 'Registration Area', position: 'Registration Desk', required: 40 },
  { name: 'Car Park', position: 'Traffic Direction', required: 50 },
  { name: 'Rotunda', position: "Ministers' Escort", required: 16 },
  { name: 'Overflow', position: 'Overflow Seating', required: 60 },
  { name: 'First Aid Point', position: 'First Aid Support', required: 12 },
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

export const DEMO = { found: '08031234567', unassigned: '08051112233', missing: '08099990000' }

export function createSeed(): SeedState {
  const rnd = mulberry32(20261114)
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

  /* ---------- events ---------- */
  const events: MinistryEvent[] = [
    {
      id: 'ev_tga26', name: 'The Global Apostolic Invasion 2026', code: 'TGA 2026',
      description: 'Annual global gathering. Full department deployment across the auditorium, gallery, overflow and grounds.',
      date: '2026-11-14', venue: 'Koinonia Global Centre, Abuja', reportingTime: '15:30', briefingTime: '16:00',
      dressCode: 'Departmental Uniform', status: 'active', rosterStatus: 'published', publishedAt: ago(60 * 26),
      instructions: 'All ushers must report at least 30 minutes before the department briefing. Collect your aisle tag from your Aisle Lead.',
    },
    {
      id: 'ev_ms_oct', name: 'Miracle Service: October', code: 'MS OCT',
      description: 'Monthly miracle service. Reduced deployment, main hall and entrances only.',
      date: '2026-10-25', venue: 'Koinonia Global Centre, Abuja', reportingTime: '07:00', briefingTime: '07:30',
      dressCode: 'White top, black bottom', status: 'active', rosterStatus: 'published', publishedAt: ago(60 * 50),
      instructions: 'Report to your zone lead on arrival. Keep the front five rows clear for ministers until 9:00 AM.',
    },
    {
      id: 'ev_sor26', name: 'SOR 2026', code: 'SOR 2026',
      description: 'Year-end programme. Roster in preparation.',
      date: '2026-12-12', venue: 'Koinonia Global Centre, Abuja', reportingTime: '14:00', briefingTime: '14:30',
      dressCode: 'Departmental Uniform', status: 'draft', rosterStatus: 'draft',
    },
    {
      id: 'ev_klc26', name: "Koinonia Leaders' Conference 2026", code: 'KLC 2026',
      description: 'Three-day leadership conference.',
      date: '2026-08-22', venue: 'Eagle Square, Abuja', reportingTime: '08:00', briefingTime: '08:30',
      dressCode: 'Departmental Uniform', status: 'completed', rosterStatus: 'published', publishedAt: '2026-08-15T10:00:00.000Z',
    },
  ]

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
    for (let a = 1; a <= AISLE_COUNT; a++) {
      const z = zone(`a${a}`, `Aisle ${a}`, 'aisle', `A${a}`)
      AISLE_POSITIONS.forEach((p, i) =>
        positions.push({ id: `${z.id}_p${i}`, name: p.name, zoneId: z.id, order: i, isLeadRole: p.lead, required: p.required }))
    }
    for (let n = 1; n <= SECTION_COUNT; n++) {
      const z = zone(`s${n}`, `Section ${n}`, 'section', `S${n}`)
      if (hasSpots(n))
        SPOTS.forEach((sp, i) => positions.push({ id: `${z.id}_${sp.key}`, name: sp.name, zoneId: z.id, order: i, required: 1, spot: sp.key }))
      else
        positions.push({ id: `${z.id}_p0`, name: n === MEDIA_SECTION ? 'Media Liaison' : SPOTLESS_SECTION_POSITION.name, zoneId: z.id, order: 0, required: SPOTLESS_SECTION_POSITION.required })
    }
    for (const d of DOORS) {
      const z = zone(`d${d.ref}`, `Door ${d.ref}`, 'door', d.ref)
      positions.push({ id: `${z.id}_p0`, name: 'Door Control', zoneId: z.id, order: 0, required: DOOR_REQUIRED[d.kind] })
    }
    AREA_ZONES.forEach((ar, i) => {
      const z = zone(`z${i}`, ar.name, 'area', ar.ref)
      positions.push({ id: `${z.id}_p0`, name: ar.position, zoneId: z.id, order: 0, required: ar.required })
    })
  }

  /* ---------- assignments ---------- */
  const assignments: Assignment[] = []
  let aCount = 0
  const add = (memberId: string, eventId: string, positionId: string, isTeamLead = false, status: Assignment['status'] = 'confirmed') => {
    const pos = positions.find((p) => p.id === positionId)!
    assignments.push({ id: `as${++aCount}`, memberId, eventId, zoneId: pos.zoneId, positionId, isTeamLead, status, updatedAt: ago(60 * 24 + aCount % 900) })
  }
  const posOf = (eventId: string, zoneName: string, posName: string) => {
    const z = zones.find((z) => z.eventId === eventId && z.name === zoneName)!
    return positions.find((p) => p.zoneId === z.id && p.name === posName)!.id
  }

  // TGA 2026: the demo flow
  const T = 'ev_tga26'
  add('m1', T, posOf(T, 'Section 41', 'Front row, left end'))
  add('m2', T, posOf(T, 'Section 41', 'Back row, left end'), true)
  add('m3', T, posOf(T, 'Section 41', 'Front row, right end'))
  add('m4', T, posOf(T, 'Section 41', 'Back row, right end'))
  add('m5', T, posOf(T, 'Aisle 4', 'Control 1'))
  add('m6', T, posOf(T, 'Aisle 1', 'Aisle Lead'), true)
  add('m7', T, posOf(T, 'Main Gate', 'Welcome & Direction'), true)
  add('m8', T, posOf(T, 'Aisle 2', 'Aisle Lead'), true)
  // m9 Faith Ibrahim stays unassigned for TGA on purpose
  add('m10', T, posOf(T, 'Altar & Pulpit', 'Altar Protocol'), true)
  add('m11', T, posOf(T, 'Aisle 3', 'Control 2'))
  add('m12', T, posOf(T, 'Car Park', 'Traffic Direction'), true)
  add('m13', T, posOf(T, 'Section 12', 'Front row, left end'), true)

  // Fill every TGA zone to a realistic coverage level, landing on exactly TARGET assigned.
  const fill: Record<string, number> = {
    'Aisle 1': 0.94, 'Aisle 2': 1, 'Aisle 3': 0.97, 'Aisle 4': 0.9, 'Aisle 5': 0.85, 'Aisle 6': 1,
    Overflow: 0.62, 'Car Park': 0.7, 'First Aid Point': 0.75, 'Registration Area': 0.8, 'Door X2': 0.6, 'Door E3': 0.75,
  }
  // the back sections and a few others run short, so the map has something to show
  const shortSections = [73, 74, 77, 82, 83, 84, 85, 88, 89, 90, 64, 66, 70, 55, 59, 47, 52, 36, 43, 29]
  shortSections.forEach((n, i) => (fill[`Section ${n}`] = [0.5, 0.75, 0.5, 0.75, 0.25][i % 5]))
  const pool = members.filter((m) => m.status === 'active' && !['m9'].includes(m.id) && !assignments.some((a) => a.memberId === m.id && a.eventId === T))
  let poolIdx = 0
  const TARGET = 920
  const tgaZones = zones.filter((z) => z.eventId === T)
  outer: for (const z of tgaZones) {
    for (const p of positions.filter((p) => p.zoneId === z.id)) {
      // an usher spot is filled or not; other positions fill to a share of their headcount
      const want = p.spot ? (rnd() < (fill[z.name] ?? 0.97) ? 1 : 0) : Math.round((p.required ?? 0) * (fill[z.name] ?? 1))
      let have = assignments.filter((a) => a.positionId === p.id).length
      while (have < want) {
        if (assignments.filter((a) => a.eventId === T).length >= TARGET || poolIdx >= pool.length) break outer
        add(pool[poolIdx++].id, T, p.id, p.isLeadRole && have === 0, rnd() < 0.82 ? 'confirmed' : 'assigned')
        have++
      }
    }
  }
  // top up any shortfall on the busiest zones
  const topUp = [posOf(T, 'Overflow', 'Overflow Seating'), posOf(T, 'Car Park', 'Traffic Direction')]
  let t = 0
  while (assignments.filter((a) => a.eventId === T).length < TARGET && poolIdx < pool.length)
    add(pool[poolIdx++].id, T, topUp[t++ % 2], false, 'assigned')

  // Smaller rosters for the other events
  const smallRoster = (evId: string, count: number, onlyAisles: boolean, status: Assignment['status']) => {
    const evZones = zones.filter((z) => z.eventId === evId && (!onlyAisles || z.kind === 'aisle' || z.kind === 'door' || ['Main Gate', 'Car Park'].includes(z.name)))
    const evPos = positions.filter((p) => evZones.some((z) => z.id === p.zoneId))
    // an usher spot takes one person; other positions take their full headcount
    const slots = evPos.flatMap((p) => (p.spot ? [p] : Array<Position>(p.required ?? 1).fill(p)))
    const shuffled = [...members].filter((m) => m.status === 'active' && m.id !== 'm9').sort(() => rnd() - 0.5)
    const taken = new Set(assignments.filter((a) => a.eventId === evId).map((a) => a.memberId))
    let k = 0
    for (const m of shuffled) {
      if (k >= count) break
      if (taken.has(m.id)) continue
      const p = slots[k % slots.length]
      const lead = p.isLeadRole && !assignments.some((a) => a.positionId === p.id)
      add(m.id, evId, p.id, !!lead, status)
      k++
    }
  }
  add('m1', 'ev_ms_oct', posOf('ev_ms_oct', 'Main Gate', 'Welcome & Direction'))
  add('m1', 'ev_klc26', posOf('ev_klc26', 'Section 18', 'Front row, left end'))
  add('m1', 'ev_sor26', posOf('ev_sor26', 'Aisle 5', 'Control 1'), false, 'assigned')
  smallRoster('ev_ms_oct', 340, true, 'confirmed')
  smallRoster('ev_klc26', 420, false, 'confirmed')
  smallRoster('ev_sor26', 210, false, 'assigned')

  /* ---------- activity + notifications ---------- */
  const activity: Activity[] = [
    { id: 'ac1', actor: 'Daniel', text: 'assigned 12 ushers to Aisle 4', at: ago(14), kind: 'assign' },
    { id: 'ac2', actor: 'Grace', text: 'updated TGA 2026 reporting time to 3:30 PM', at: ago(52), kind: 'event' },
    { id: 'ac3', actor: 'Admin', text: 'imported 56 members from members-oct.csv', at: ago(60 * 3), kind: 'import' },
    { id: 'ac4', actor: 'Deborah', text: 'added Door M3 to TGA 2026 positions', at: ago(60 * 7), kind: 'position' },
    { id: 'ac5', actor: 'Admin', text: 'published the TGA 2026 roster', at: ago(60 * 26), kind: 'publish' },
    { id: 'ac6', actor: 'Samuel', text: 'reassigned 4 ushers from Overflow to Section 19', at: ago(60 * 30), kind: 'assign' },
    { id: 'ac7', actor: 'Grace', text: 'created SOR 2026 as a draft', at: ago(60 * 49), kind: 'event' },
  ]
  const notifications: AppNotification[] = [
    { id: 'n1', title: 'Unassigned members remaining', body: `${members.length - TARGET} members have no position for TGA 2026.`, at: ago(30), tone: 'warn', read: false },
    { id: 'n2', title: 'Event approaching', body: 'Miracle Service: October is in 17 days. Its roster is published.', at: ago(60 * 2), tone: 'info', read: false },
    { id: 'n3', title: 'Import completed', body: '56 members imported. 2 rows skipped for duplicate phone numbers.', at: ago(60 * 3), tone: 'success', read: false },
    { id: 'n4', title: 'Duplicate phone numbers found', body: '2 rows in members-oct.csv matched existing members.', at: ago(60 * 3 + 1), tone: 'warn', read: true },
    { id: 'n5', title: 'Roster published', body: 'TGA 2026 assignments are now visible to ushers.', at: ago(60 * 26), tone: 'success', read: true },
  ]

  return { members, events, zones, positions, assignments, activity, notifications, activeEventId: T }
}
