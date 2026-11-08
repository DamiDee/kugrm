import type { SpotKey, Zone, ZoneKind } from './types'

/**
 * The Koinonia Global Arena floor plan (105 m × 90 m), in plan units that
 * match the drawing DRE supplied (1 unit ≈ 1 px of that plan).
 *
 * The altar is on the east (right) wall. Seating is 83 sections in seven
 * columns, numbered column by column from the altar side: the column nearest
 * the altar holds 1 to 11 (top to bottom), the next 12 to 23, and so on to
 * the back column, 72 to 83. Each section is 11 rows of 12 seats; the front
 * block of Nave B (sections 5, 6 and 7) has 17, 16 and 17 rows. Sections 17
 * and 18 are the technical and media block.
 *
 * Aisles 1 to 9 run across the hall between the section rows, each with an
 * aisle door (D1–D9) on the back wall. Two tent lines, where a chair column
 * was removed for the aluminium pillars, also cross the hall; they are not
 * aisles. The hall splits into Nave C, B and A, 30 m each.
 *
 * Every section except 5, 6, 7, 17 and 18 has four usher seats: the first
 * and last row, at both ends.
 */

export type Rect = { x: number; y: number; w: number; h: number }

export const PLAN = {
  /** everything drawn, including labels outside the walls */
  view: { x: 0, y: 18, w: 1534, h: 1302 } as Rect,
  building: { x: 107, y: 104, w: 1331, h: 1142 } as Rect,
  seating: { x: 160, y: 117, w: 1028, h: 1117 } as Rect,
}

const COLS = 7
const ROWS = 12
const COL_X0 = 172
const COL_STEP = 145.3
const COL_W = 133
const ROW_Y = [121, 212, 305, 398, 498, 591, 684, 777, 877, 970, 1063, 1156]
const ROW_H = 75

export const SECTION_COUNT = 83
export const AISLE_COUNT = 9
export const SEATS_PER_SECTION = 132
export const SECTION_ROWS = 11
export const SEATS_PER_ROW = 12

/** Sections drawn somewhere other than their grid cell. */
const SPECIAL_RECTS: Record<number, Rect> = {
  5: { x: 1044, y: 500, w: 132, h: 108 },
  6: { x: 1044, y: 627, w: 132, h: 98 },
  7: { x: 1044, y: 744, w: 132, h: 106 },
  17: { x: 903, y: 605, w: 54, h: 141 },
  18: { x: 962, y: 605, w: 55, h: 141 },
}

/** Column 0 is the back (west) column, row 0 the top (north) row. */
export function sectionCell(n: number) {
  if (n <= 11) {
    // the altar column: 1–4 in Nave C, 5–7 the front block of Nave B, 8–11 in Nave A
    const row = n <= 4 ? n - 1 : n <= 7 ? n - 1 : n
    return { col: COLS - 1, row }
  }
  const m = n - 12
  return { col: COLS - 2 - Math.floor(m / ROWS), row: m % ROWS }
}
export function sectionRect(n: number): Rect {
  if (SPECIAL_RECTS[n]) return SPECIAL_RECTS[n]
  const { col, row } = sectionCell(n)
  return { x: COL_X0 + col * COL_STEP, y: ROW_Y[row], w: COL_W, h: ROW_H }
}
export const colCenterX = (col: number) => COL_X0 + col * COL_STEP + COL_W / 2

/* ---------- aisles and tent lines ---------- */

/** The row each aisle runs below. */
const AISLE_ROWS: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 4, 5: 5, 6: 6, 7: 8, 8: 9, 9: 10 }
export const TENT_ROWS = [3, 7]
const gapY = (row: number) => {
  const top = ROW_Y[row] + ROW_H
  return { y: top, h: ROW_Y[row + 1] - top }
}
const SEAT_X0 = PLAN.seating.x
const SEAT_X1 = PLAN.seating.x + PLAN.seating.w

/**
 * The strips each aisle is drawn as. In the front block of Nave B the aisles
 * shift: aisle 4 runs below section 5, aisle 6 below section 6, and aisles 5
 * and 6 stop at the technical and media block.
 */
export function aisleRects(n: number): Rect[] {
  const { y, h } = gapY(AISLE_ROWS[n])
  if (n === 4) return [{ x: SEAT_X0, y, w: 1036 - SEAT_X0, h }, { x: 1038, y: 609, w: SEAT_X1 - 1038, h: 16 }]
  if (n === 5) return [{ x: SEAT_X0, y, w: 891 - SEAT_X0, h }]
  if (n === 6) return [{ x: SEAT_X0, y, w: 891 - SEAT_X0, h }, { x: 1038, y: 726, w: SEAT_X1 - 1038, h: 16 }]
  return [{ x: SEAT_X0, y, w: SEAT_X1 - SEAT_X0, h }]
}
/** The aisle's main strip, used to zoom to and describe it. */
export const aisleRect = (n: number) => aisleRects(n)[0]
export const aisleCenterY = (n: number) => aisleRect(n).y + aisleRect(n).h / 2
/** Columns whose label sits on each aisle strip (the plan writes AISLE n under every section). */
export function aisleLabelCols(n: number) {
  if (n === 5 || n === 6) return [0, 1, 2, 3, 4]
  if (n === 4) return [0, 1, 2, 3, 4, 5]
  return [0, 1, 2, 3, 4, 5, 6]
}
export const tentLineY = (row: number) => gapY(row).y + gapY(row).h / 2
/** x of each aluminium pillar along a tent line */
export const PILLAR_X = Array.from({ length: COLS + 1 }, (_, i) => (i === 0 ? 165 : i === COLS ? 1181 : COL_X0 + i * COL_STEP - (COL_STEP - COL_W) / 2))
/** Nave B aisles 4 to 6, the central lane, drawn darker. */
export const LANE_AISLES = [4, 5, 6]

/* ---------- usher seats ---------- */

/** Front is the row nearest the altar; left and right as seen facing the altar. */
export const SPOTS: { key: SpotKey; name: string }[] = [
  { key: 'FL', name: 'Front row, left end' },
  { key: 'FR', name: 'Front row, right end' },
  { key: 'BL', name: 'Back row, left end' },
  { key: 'BR', name: 'Back row, right end' },
]
export const spotName = (k: SpotKey) => SPOTS.find((s) => s.key === k)!.name
/** Sections without usher seats: Lady Sandra's, protocols, ministers, and the technical and media block. */
export const NO_SPOT_SECTIONS = [5, 6, 7, 17, 18]
export const hasSpots = (n: number) => n >= 1 && n <= SECTION_COUNT && !NO_SPOT_SECTIONS.includes(n)
export function spotPoint(n: number, k: SpotKey) {
  const r = sectionRect(n)
  // facing the altar (east), left is north (top of the plan)
  const x = k[0] === 'F' ? r.x + r.w : r.x
  const y = k[1] === 'L' ? r.y : r.y + r.h
  return { x, y }
}

/* ---------- doors ---------- */

/**
 * aisle: an aisle door on the back wall, open during service.
 * closed: an aisle door kept closed during service (D2, D5, D8).
 * twoway: the public entrance and exit doors on the Nave C wall (X3–X5).
 * workers: workers-only entrance and exit on the Nave A wall (X1, X2).
 * access: the ministers' and worship team's doors by the stage (M1–M3).
 */
export type DoorKind = 'aisle' | 'closed' | 'twoway' | 'workers' | 'access'
export interface Door {
  ref: string
  kind: DoorKind
  side: 'top' | 'bottom' | 'left' | 'right'
  /** start and end of the opening along its wall */
  a: number
  b: number
  /** label badge centre */
  label: { x: number; y: number }
  note: string
}

const AISLE_DOOR_Y = [203, 296, 389, 582, 675, 768, 962, 1055, 1148]
const CLOSED_DOORS = [2, 5, 8]

export const DOORS: Door[] = [
  ...AISLE_DOOR_Y.map((y, i): Door => {
    const closed = CLOSED_DOORS.includes(i + 1)
    return {
      ref: `D${i + 1}`, kind: closed ? 'closed' : 'aisle', side: 'left', a: y - 22, b: y + 22, label: { x: 77, y },
      note: closed ? `Aisle ${i + 1} door, closed during service` : `Aisle ${i + 1} door, back wall`,
    }
  }),
  { ref: 'X3', kind: 'twoway', side: 'top', a: 290, b: 330, label: { x: 310, y: 80 }, note: 'Two-way door, entrance and exit (Nave C)' },
  { ref: 'X4', kind: 'twoway', side: 'top', a: 580, b: 620, label: { x: 600, y: 80 }, note: 'Two-way door, entrance and exit (Nave C)' },
  { ref: 'X5', kind: 'twoway', side: 'top', a: 871, b: 911, label: { x: 891, y: 80 }, note: 'Two-way door, entrance and exit (Nave C)' },
  { ref: 'X1', kind: 'workers', side: 'bottom', a: 437, b: 474, label: { x: 455, y: 1272 }, note: 'Workers only, entrance and exit (Nave A)' },
  { ref: 'X2', kind: 'workers', side: 'bottom', a: 727, b: 765, label: { x: 746, y: 1272 }, note: 'Workers only, entrance and exit (Nave A)' },
  { ref: 'M3', kind: 'access', side: 'top', a: 1175, b: 1228, label: { x: 1201, y: 80 }, note: 'Access door beside the worship team, near Section 1' },
  { ref: 'M2', kind: 'access', side: 'right', a: 125, b: 178, label: { x: 1468, y: 152 }, note: 'Worship team access door' },
  { ref: 'M1', kind: 'access', side: 'right', a: 1030, b: 1083, label: { x: 1468, y: 1056 }, note: 'Ministers and the Rotunda, by the covered walkway' },
]
export const DOOR_KIND_LABEL: Record<DoorKind, string> = {
  aisle: 'Aisle door',
  closed: 'Aisle door, closed during service',
  twoway: 'Entrance and exit',
  workers: 'Workers only',
  access: 'Access door',
}

export function doorRect(d: Door): Rect {
  const B = PLAN.building
  const depth = (d.b - d.a) / 2 + 6
  if (d.side === 'top') return { x: d.a, y: B.y - 6, w: d.b - d.a, h: depth }
  if (d.side === 'bottom') return { x: d.a, y: B.y + B.h - depth + 6, w: d.b - d.a, h: depth }
  if (d.side === 'left') return { x: B.x - 6, y: d.a, w: depth, h: d.b - d.a }
  return { x: B.x + B.w - depth + 6, y: d.a, w: depth, h: d.b - d.a }
}

/* ---------- areas beside the altar ---------- */

export interface PlanArea {
  ref: string
  name: string
  rect: Rect
  note?: string
}

export const AREAS: PlanArea[] = [
  { ref: 'worship', name: 'Worship Team', rect: { x: 1241, y: 182, w: 177, h: 174 } },
  { ref: 'altar', name: 'Altar & Pulpit', rect: { x: 1240, y: 491, w: 178, h: 370 }, note: 'Pulpit and platform, 30 m wide (Nave B)' },
  { ref: 'screen', name: 'Crane Screen', rect: { x: 1419, y: 489, w: 13, h: 372 }, note: 'LED screen on the crane, in the 1 m strip behind the stage' },
  { ref: 'tech', name: 'Technical Space', rect: { x: 1241, y: 935, w: 177, h: 90 }, note: 'Stage, beside the altar' },
  { ref: 'walkway', name: 'Covered Walkway', rect: { x: 1241, y: 1030, w: 197, h: 53 }, note: 'Covered, screened walkway inside, from door M1 to the stage' },
  { ref: 'reserve', name: 'Stage Reserve', rect: { x: 1241, y: 1089, w: 177, h: 126 } },
  { ref: 'apostle', name: "Apostle's Chairs", rect: { x: 1178, y: 627, w: 21, h: 98 }, note: 'Nine special chairs for the Apostle and guest ministers' },
  { ref: 'protocol', name: 'Protocol Row', rect: { x: 1150, y: 628, w: 19, h: 72 }, note: 'Front row of Section 6' },
]

export const NAVES = [
  { name: 'NAVE C', size: '30 m', y0: 104, y1: 486 },
  { name: 'NAVE B', size: '30 m', y0: 486, y1: 864 },
  { name: 'NAVE A', size: '30 m', y0: 864, y1: 1246 },
]

/* ---------- section types ---------- */

export const INTERNATIONAL = [8, 9, 19, 20, 21, 31, 32, 33]
export type SectionStyle = 'standard' | 'international' | 'lady' | 'protocol' | 'ministers' | 'technical' | 'media'
export function sectionStyle(n: number): SectionStyle {
  if (n === 5) return 'lady'
  if (n === 6) return 'protocol'
  if (n === 7) return 'ministers'
  if (n === 17) return 'technical'
  if (n === 18) return 'media'
  if (INTERNATIONAL.includes(n)) return 'international'
  return 'standard'
}
/** The outer sections by the exit doors (top and bottom rows), 11 × 11, dashed on the plan. */
export const isOuterSection = (n: number) => {
  if (SPECIAL_RECTS[n]) return false
  const { row } = sectionCell(n)
  return row === 0 || row === ROWS - 1
}
const SECTION_NOTES: Record<SectionStyle, string | undefined> = {
  standard: undefined,
  international: 'International guests',
  lady: 'Lady Sandra’s section',
  protocol: 'Protocols on the front row',
  ministers: 'Ministers, HODs and sons of the ministry',
  technical: 'Technical (with Section 18)',
  media: 'Media and videography (with Section 17)',
}
export function sectionNote(n: number) {
  return [SECTION_NOTES[sectionStyle(n)], isOuterSection(n) ? 'Outer section, 11 × 11' : undefined].filter(Boolean).join(', ') || undefined
}
export function naveOf(n: number) {
  const r = sectionRect(n)
  const cy = r.y + r.h / 2
  return NAVES.find((v) => cy >= v.y0 && cy < v.y1)?.name.replace('NAVE', 'Nave') ?? 'Nave B'
}

/* ---------- linking roster zones to the plan ---------- */

/**
 * The plan reference for a zone: S1–S83, A1–A9, a door code, or an area ref.
 * Zones named like the plan ("Section 14", "Aisle 2", "Door D4") are placed
 * even without an explicit mapRef, so zones added by an admin show up too.
 */
export function zoneRef(zone: Pick<Zone, 'name' | 'mapRef'>): string | undefined {
  if (zone.mapRef) return zone.mapRef
  const name = zone.name.trim()
  let m = name.match(/^sec(?:tion)?\.?\s*(\d{1,2})$/i)
  if (m && +m[1] >= 1 && +m[1] <= SECTION_COUNT) return `S${+m[1]}`
  m = name.match(/^aisle\s*(\d)$/i)
  if (m && +m[1] >= 1 && +m[1] <= AISLE_COUNT) return `A${+m[1]}`
  m = name.match(/^(?:door\s*)?([DXM]\d)\b/i)
  if (m && DOORS.some((d) => d.ref === m![1].toUpperCase())) return m[1].toUpperCase()
  const area = AREAS.find((a) => a.name.toLowerCase() === name.toLowerCase())
  return area?.ref
}

export const sectionOfRef = (ref: string | undefined) => (ref && /^S\d+$/.test(ref) ? +ref.slice(1) : undefined)

export function refRect(ref: string): Rect | undefined {
  const n = sectionOfRef(ref)
  if (n) return sectionRect(n)
  if (/^A\d$/.test(ref)) return aisleRect(+ref.slice(1))
  const door = DOORS.find((d) => d.ref === ref)
  if (door) return doorRect(door)
  return AREAS.find((a) => a.ref === ref)?.rect
}

/** A one-line description of where a zone is, for cards and panels. */
export function zoneNote(zone: Pick<Zone, 'name' | 'mapRef'>): string | undefined {
  const ref = zoneRef(zone)
  if (!ref) return undefined
  const n = sectionOfRef(ref)
  if (n) return [sectionNote(n), naveOf(n)].filter(Boolean).join(' · ')
  if (/^A\d$/.test(ref)) {
    const a = +ref.slice(1)
    return `Across the hall, door D${a} on the back wall${LANE_AISLES.includes(a) ? ' · Nave B central lane' : ''}`
  }
  const door = DOORS.find((d) => d.ref === ref)
  if (door) return door.note
  return AREAS.find((a) => a.ref === ref)?.note
}

/** The open door closest to a zone or spot, to tell an usher which way to come in. */
export function nearestEntrance(ref: string | undefined, point?: { x: number; y: number }) {
  const r = point ? { ...point, w: 0, h: 0 } : ref && refRect(ref)
  if (!r) return undefined
  let best: { door: Door; d: number } | undefined
  for (const door of DOORS.filter((d) => d.kind === 'aisle' || d.kind === 'twoway' || d.kind === 'workers')) {
    const dr = doorRect(door)
    const cx = dr.x + dr.w / 2
    const cy = dr.y + dr.h / 2
    const dx = Math.max(r.x - cx, 0, cx - (r.x + r.w))
    const dy = Math.max(r.y - cy, 0, cy - (r.y + r.h))
    const d = Math.hypot(dx, dy)
    if (!best || d < best.d) best = { door, d }
  }
  return best?.door
}

export const ZONE_KIND_LABEL: Record<ZoneKind, string> = { aisle: 'Aisle', section: 'Section', door: 'Door', area: 'Area' }
export const ZONE_KIND_PLURAL: Record<ZoneKind, string> = { aisle: 'Aisles', section: 'Sections', door: 'Doors', area: 'Areas' }

export function leadLabel(zone: Pick<Zone, 'kind'>) {
  return zone.kind === 'aisle' ? 'Aisle lead' : zone.kind === 'section' ? 'Section lead' : 'Team lead'
}
