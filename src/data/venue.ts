import type { SpotKey, Zone, ZoneKind } from './types'

/**
 * The main auditorium floor plan (105 m × 90 m), in plan units.
 *
 * The altar is on the east (right) wall. Seating is 90 sections of 160 seats
 * (16 × 10) in ten columns by nine rows, numbered column by column from the
 * altar side: the column nearest the altar holds 1 to 9 (top to bottom), the
 * back column 82 to 90. Aisles 1 to 6 run between the rows. Two tent lines,
 * where a chair column was removed for the iron pillars, also cross the hall;
 * they are not aisles. The hall splits into Nave C, B and A, 30 m each.
 *
 * Every section except 1–9 and 32 has four usher spots: the first and last
 * row, at both ends.
 */

export type Rect = { x: number; y: number; w: number; h: number }

export const PLAN = {
  /** everything drawn, including door labels outside the walls */
  view: { x: 30, y: 10, w: 1720, h: 1380 } as Rect,
  building: { x: 145, y: 80, w: 1462, h: 1247 } as Rect,
  seating: { x: 200, y: 97, w: 1113, h: 1208 } as Rect,
}

const COLS = 10
const ROWS = 9
const COL_X0 = 218
const COL_STEP = 111.1
const COL_W = 93
const ROW_Y = [122, 250, 378, 516, 655, 793, 932, 1060, 1188]
const ROW_H = 96

export const SECTION_COUNT = COLS * ROWS
export const AISLE_COUNT = 6
export const SEATS_PER_SECTION = 160

/** Column 0 is the back (west) column, row 0 the top (north) row. */
export function sectionAt(col: number, row: number) {
  return (COLS - 1 - col) * ROWS + row + 1
}
export function sectionCell(n: number) {
  return { col: COLS - 1 - Math.floor((n - 1) / ROWS), row: (n - 1) % ROWS }
}
export function sectionRect(n: number): Rect {
  const { col, row } = sectionCell(n)
  return { x: COL_X0 + col * COL_STEP, y: ROW_Y[row], w: COL_W, h: ROW_H }
}

/** The pair of rows each aisle runs between, and where the tent lines are. */
const AISLE_ROWS: Record<number, number> = { 1: 0, 2: 1, 3: 3, 4: 4, 5: 6, 6: 7 }
export const TENT_ROWS = [2, 5]
const gapRect = (row: number): Rect => {
  const top = ROW_Y[row] + ROW_H
  return { x: PLAN.seating.x, y: top, w: PLAN.seating.w, h: ROW_Y[row + 1] - top }
}
export function aisleRect(n: number): Rect {
  return gapRect(AISLE_ROWS[n])
}
export const aisleCenterY = (n: number) => aisleRect(n).y + aisleRect(n).h / 2
export const tentLineY = (row: number) => gapRect(row).y + gapRect(row).h / 2
/** x of each iron pillar along a tent line */
export const PILLAR_X = Array.from({ length: COLS + 1 }, (_, i) => (i === 0 ? 212 : i === COLS ? 1311 : COL_X0 + i * COL_STEP - (COL_STEP - COL_W) / 2))
/** Aisles drawn as highlighted lanes on the plan. */
export const LANE_AISLES = [3, 4]

/* ---------- usher spots ---------- */

/** Front is the row nearest the altar; left and right as seen facing the altar. */
export const SPOTS: { key: SpotKey; name: string }[] = [
  { key: 'FL', name: 'Front row, left end' },
  { key: 'FR', name: 'Front row, right end' },
  { key: 'BL', name: 'Back row, left end' },
  { key: 'BR', name: 'Back row, right end' },
]
export const spotName = (k: SpotKey) => SPOTS.find((s) => s.key === k)!.name
/** Sections without usher spots: the front column (VIP, ministers, protocol) and the media section. */
export const NO_SPOT_SECTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 32]
export const hasSpots = (n: number) => !NO_SPOT_SECTIONS.includes(n)
export function spotPoint(n: number, k: SpotKey) {
  const r = sectionRect(n)
  // facing the altar (east), left is north (top of the plan)
  const x = k[0] === 'F' ? r.x + r.w : r.x
  const y = k[1] === 'L' ? r.y : r.y + r.h
  return { x, y }
}

/* ---------- doors ---------- */

export type DoorKind = 'entrance' | 'exit' | 'access'
export interface Door {
  ref: string
  kind: DoorKind
  side: 'top' | 'bottom' | 'left' | 'right'
  /** start and end of the opening along its wall */
  a: number
  b: number
  /** label badge centre */
  label: { x: number; y: number }
  note?: string
}

export const DOORS: Door[] = [
  { ref: 'E4', kind: 'entrance', side: 'top', a: 278, b: 365, label: { x: 322, y: 44 } },
  { ref: 'E2', kind: 'entrance', side: 'left', a: 320, b: 405, label: { x: 100, y: 362 } },
  { ref: 'E1', kind: 'entrance', side: 'left', a: 1002, b: 1087, label: { x: 100, y: 1045 } },
  { ref: 'E3', kind: 'entrance', side: 'bottom', a: 278, b: 365, label: { x: 322, y: 1364 } },
  { ref: 'X3', kind: 'exit', side: 'top', a: 612, b: 695, label: { x: 653, y: 110 } },
  { ref: 'X4', kind: 'exit', side: 'top', a: 947, b: 1030, label: { x: 989, y: 110 } },
  { ref: 'X1', kind: 'exit', side: 'bottom', a: 612, b: 695, label: { x: 653, y: 1295 } },
  { ref: 'X2', kind: 'exit', side: 'bottom', a: 947, b: 1030, label: { x: 989, y: 1295 } },
  { ref: 'M3', kind: 'access', side: 'top', a: 1318, b: 1377, label: { x: 1369, y: 44 }, note: 'Beside the worship team, near Section 1' },
  { ref: 'M2', kind: 'access', side: 'right', a: 90, b: 150, label: { x: 1658, y: 120 }, note: 'Worship team access' },
  { ref: 'M1', kind: 'access', side: 'right', a: 1088, b: 1146, label: { x: 1658, y: 1118 }, note: 'Ministers and the Rotunda, by the covered walkway' },
]

export function doorRect(d: Door): Rect {
  const B = PLAN.building
  const depth = (d.b - d.a) / 2 + 8
  if (d.side === 'top') return { x: d.a, y: B.y - 8, w: d.b - d.a, h: depth }
  if (d.side === 'bottom') return { x: d.a, y: B.y + B.h - depth + 8, w: d.b - d.a, h: depth }
  if (d.side === 'left') return { x: B.x - 8, y: d.a, w: depth, h: d.b - d.a }
  return { x: B.x + B.w - depth + 8, y: d.a, w: depth, h: d.b - d.a }
}

/* ---------- areas beside the altar ---------- */

export interface PlanArea {
  ref: string
  name: string
  rect: Rect
  note?: string
}

export const AREAS: PlanArea[] = [
  { ref: 'worship', name: 'Worship Team', rect: { x: 1390, y: 163, w: 197, h: 248 } },
  { ref: 'altar', name: 'Altar & Pulpit', rect: { x: 1390, y: 499, w: 197, h: 408 }, note: 'Pulpit and platform, 30 m wide' },
  { ref: 'screen', name: 'Crane Screen', rect: { x: 1589, y: 499, w: 14, h: 408 }, note: 'LED screen on the crane, in the 1 m strip behind the stage' },
  { ref: 'tech', name: 'Technical Space', rect: { x: 1390, y: 985, w: 197, h: 98 }, note: 'Stage, beside the altar' },
  { ref: 'walkway', name: 'Covered Walkway', rect: { x: 1390, y: 1090, w: 212, h: 53 }, note: 'Screened walkway from door M1 to the stage' },
  { ref: 'reserve', name: 'Stage Reserve', rect: { x: 1390, y: 1153, w: 197, h: 137 } },
  { ref: 'apostle', name: "Apostle's Chairs", rect: { x: 1314, y: 657, w: 23, h: 91 }, note: 'Nine special chairs for the Apostle and guest ministers' },
  { ref: 'protocol', name: 'Protocol Row', rect: { x: 1283, y: 660, w: 20, h: 86 }, note: 'Front row of Section 5' },
]

export const NAVES = [
  { name: 'NAVE C', size: '30 m', y0: 80, y1: 495 },
  { name: 'NAVE B', size: '30 m', y0: 495, y1: 911 },
  { name: 'NAVE A', size: '30 m', y0: 911, y1: 1327 },
]

/* ---------- section types ---------- */

export const INTERNATIONAL = [7, 8, 15, 16, 17, 24, 25, 26]
export const MEDIA_SECTION = 32
export type SectionStyle = 'standard' | 'international' | 'lady' | 'ministers' | 'media'
export function sectionStyle(n: number): SectionStyle {
  if (n === 4) return 'lady'
  if (n === 6) return 'ministers'
  if (n === MEDIA_SECTION) return 'media'
  if (INTERNATIONAL.includes(n)) return 'international'
  return 'standard'
}
/** Rows 1 and 9 were formed from the removed chair columns (dashed outline on the plan). */
export const isNewSection = (n: number) => {
  const { row } = sectionCell(n)
  return row === 0 || row === ROWS - 1
}
const SECTION_NOTES: Record<SectionStyle, string | undefined> = {
  standard: undefined,
  international: 'International guests',
  lady: 'Lady Sandra’s section',
  ministers: 'Ministers, HODs and sons of the ministry',
  media: 'Media and technical (videography)',
}
export function sectionNote(n: number) {
  if (n === 5) return 'Protocols on the front row'
  return SECTION_NOTES[sectionStyle(n)]
}

/* ---------- linking roster zones to the plan ---------- */

/**
 * The plan reference for a zone: S1–S90, A1–A6, a door code, or an area ref.
 * Zones named like the plan ("Section 14", "Aisle 2", "E1") are placed even
 * without an explicit mapRef, so zones added by an admin show up too.
 */
export function zoneRef(zone: Pick<Zone, 'name' | 'mapRef'>): string | undefined {
  if (zone.mapRef) return zone.mapRef
  const name = zone.name.trim()
  let m = name.match(/^sec(?:tion)?\.?\s*(\d{1,2})$/i)
  if (m && +m[1] >= 1 && +m[1] <= SECTION_COUNT) return `S${+m[1]}`
  m = name.match(/^aisle\s*(\d)$/i)
  if (m && +m[1] >= 1 && +m[1] <= AISLE_COUNT) return `A${+m[1]}`
  m = name.match(/^(?:door\s*)?([EXM]\d)\b/i)
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
  if (n) {
    const { row } = sectionCell(n)
    const nave = row < 3 ? 'Nave C' : row < 6 ? 'Nave B' : 'Nave A'
    return [sectionNote(n), nave].filter(Boolean).join(' · ')
  }
  if (/^A\d$/.test(ref)) {
    const a = +ref.slice(1)
    const row = AISLE_ROWS[a]
    return `Between section rows ${row + 1} and ${row + 2}`
  }
  const door = DOORS.find((d) => d.ref === ref)
  if (door) return door.note ?? (door.kind === 'entrance' ? 'Entrance door' : 'Exit door')
  return AREAS.find((a) => a.ref === ref)?.note
}

/** The entrance door closest to a zone, to tell an usher which way to come in. */
export function nearestEntrance(ref: string | undefined, point?: { x: number; y: number }) {
  const r = point ? { ...point, w: 0, h: 0 } : ref && refRect(ref)
  if (!r) return undefined
  let best: { door: Door; d: number } | undefined
  for (const door of DOORS.filter((d) => d.kind === 'entrance')) {
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
