import type { SpotKey, Zone, ZoneKind } from './types'

/**
 * The Koinonia Global Arena floor plan (105 m × 90 m), traced from the
 * current schematic. Plan units are 1.5 × the pixels of that drawing.
 *
 * The altar is on the east (right) wall. Seating is 84 numbered sections in
 * seven columns, numbered column by column from the altar side: the column
 * nearest the altar holds 1 to 12 (top to bottom), the next 13 to 24, and so
 * on to the back column, 73 to 84, which is narrower. Each numbered section is
 * 11 rows of 12 seats.
 *
 * Between Sections 1–12 and the altar runs the front aisle, then a column of
 * eleven named front sections (5 rows each): Sierra, Rainbow, Gulf and Foxtrot
 * in Nave C; Echo (Lady Sandra's), Delta (ADCs and PAs on the front row) and
 * Charlie (Select Contemporaries) in Nave B; Bravo (MPFs and Leaders on the
 * front row), Alpha, Yankee and Xray in Nave A.
 *
 * Aisles 1 to 9 cross the hall, each with an aisle door on the back wall:
 * C9 at aisle 1 down to C1 at aisle 9. Two tent lines, where a chair column
 * was removed for the aluminium pillars, also cross the hall; they are not
 * aisles. The hall splits into Nave C, B and A, 30 m each.
 *
 * Sections 1 to 72 have four usher seats: the first and last row, at both
 * ends. The back column (73–84) and the named sections have none.
 */

export type Rect = { x: number; y: number; w: number; h: number }

export const PLAN = {
  /** everything drawn, including labels outside the walls */
  view: { x: -10, y: 0, w: 1546, h: 1290 } as Rect,
  building: { x: 102, y: 98, w: 1281, h: 1098 } as Rect,
  seating: { x: 180, y: 112, w: 974, h: 1073 } as Rect,
}

const COLS = 7
const ROWS = 12
/** x of each numbered column, the back (west) column first; the back column is narrower */
const COL_X = [186, 264, 396, 528, 660, 792, 924]
const COL_W = [69, 123, 123, 123, 123, 123, 123]
const ROW_Y = [120, 207, 293, 378, 483, 569, 654, 740, 848, 933, 1019, 1104]
const ROW_H = 72

export const SECTION_COUNT = 84
/** numbered sections up to this one have usher seats */
export const SPOT_SECTION_MAX = 72
export const AISLE_COUNT = 9
export const SEATS_PER_SECTION = 132
export const SECTION_ROWS = 11
export const SEATS_PER_ROW = 12

/** Column 0 is the back (west) column, row 0 the top (north) row. */
export function sectionCell(n: number) {
  return { col: COLS - 1 - Math.floor((n - 1) / ROWS), row: (n - 1) % ROWS }
}
export function sectionRect(n: number): Rect {
  const { col, row } = sectionCell(n)
  let x = COL_X[col]
  let w = COL_W[col]
  // Sections beside the in-hall media and technical desks are narrower to make room for the desks
  if (n === 54 || n === 55) w = 99
  else if (n === 42 || n === 43) { x = 551; w = 100 }
  else if (n === 30 || n === 31) w = 94
  else if (n === 18 || n === 19) { x = 817; w = 98 }
  return { x, y: ROW_Y[row], w, h: ROW_H }
}
export const colCenterX = (col: number, aisle?: number) => {
  if (aisle === 5) {
    if (col === 2) return 396 + 99 / 2
    if (col === 3) return 551 + 100 / 2
    if (col === 4) return 660 + 94 / 2
    if (col === 5) return 817 + 98 / 2
  }
  return COL_X[col] + COL_W[col] / 2
}

/* ---------- front aisle and the named front sections ---------- */

const FRONT_X = COL_X[COLS - 1] + COL_W[COLS - 1]
const NAMED_X = 1072
const NAMED_W = 80
/** The aisle between Sections 1–12 and the named front sections. */
export const FRONT_AISLE: Rect = { x: FRONT_X, y: PLAN.seating.y, w: NAMED_X - FRONT_X, h: PLAN.seating.h }

export type NamedStyle = 'named' | 'lady' | 'protocol' | 'contemporaries' | 'international'
export interface NamedSection {
  ref: string
  name: string
  rect: Rect
  style: NamedStyle
  /** short label drawn beside the name tag */
  tag?: string
  note?: string
}
const namedRow = (row: number): Rect => ({ x: NAMED_X, y: ROW_Y[row], w: NAMED_W, h: ROW_H })
export const NAMED_SECTIONS: NamedSection[] = [
  { ref: 'SIERRA', name: 'Sierra', rect: namedRow(0), style: 'named' },
  { ref: 'RAINBOW', name: 'Rainbow', rect: namedRow(1), style: 'named' },
  { ref: 'GULF', name: 'Gulf', rect: namedRow(2), style: 'named' },
  { ref: 'FOXTROT', name: 'Foxtrot', rect: namedRow(3), style: 'named' },
  { ref: 'ECHO', name: 'Echo', rect: { x: NAMED_X, y: 483, w: NAMED_W, h: 99 }, style: 'lady', tag: 'Lady Sandra’s', note: 'Lady Sandra’s section' },
  { ref: 'DELTA', name: 'Delta', rect: { x: NAMED_X, y: 593, w: NAMED_W, h: 100 }, style: 'protocol', note: 'ADCs and PAs on the front row, glass screen beside it' },
  { ref: 'CHARLIE', name: 'Charlie', rect: { x: NAMED_X, y: 710, w: NAMED_W, h: 102 }, style: 'contemporaries', tag: 'Contemporaries', note: 'Select Contemporaries' },
  { ref: 'BRAVO', name: 'Bravo', rect: namedRow(8), style: 'international', tag: 'MPFs & Leaders', note: 'MPFs and Leaders on the front row, international guests' },
  { ref: 'ALPHA', name: 'Alpha', rect: namedRow(9), style: 'international', note: 'International guests' },
  { ref: 'YANKEE', name: 'Yankee', rect: namedRow(10), style: 'named' },
  { ref: 'XRAY', name: 'Xray', rect: namedRow(11), style: 'named' },
]
export const namedOfRef = (ref: string | undefined) => (ref ? NAMED_SECTIONS.find((s) => s.ref === ref) : undefined)

/* ---------- aisles and tent lines ---------- */

/** The row each aisle runs below. */
const AISLE_ROWS: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 4, 5: 5, 6: 6, 7: 8, 8: 9, 9: 10 }
export const TENT_ROWS = [3, 7]
const gapY = (row: number) => {
  const top = ROW_Y[row] + ROW_H
  return { y: top, h: ROW_Y[row + 1] - top }
}
/** Nave B aisles 4 to 6, the central lane, drawn darker. */
export const LANE_AISLES = [4, 5, 6]
/** x of the aisle number badges, just inside the back wall */
export const AISLE_BADGE_X = 140

/**
 * The strip each aisle is drawn as. Aisles 4 to 6 stop at the front aisle,
 * since the Nave B named sections (Echo, Delta, Charlie) don't line up with
 * the numbered rows.
 */
export function aisleRects(n: number): Rect[] {
  const { y, h } = gapY(AISLE_ROWS[n])
  const x0 = PLAN.seating.x
  const x1 = LANE_AISLES.includes(n) ? FRONT_X : PLAN.seating.x + PLAN.seating.w
  return [{ x: x0, y, w: x1 - x0, h }]
}
/** The aisle's main strip, used to zoom to and describe it. */
export function aisleRect(n: number) {
  return aisleRects(n)[0]
}
export function aisleCenterY(n: number) {
  const r = aisleRect(n)
  return r.y + r.h / 2
}
/** Columns whose label sits on each aisle strip (the plan writes AISLE n under every column). */
export function aisleLabelCols(_n: number) {
  return [0, 1, 2, 3, 4, 5, 6]
}
export const tentLineY = (row: number) => gapY(row).y + gapY(row).h / 2
/** x of each aluminium pillar along a tent line */
export const PILLAR_X = [
  PLAN.seating.x - 4,
  ...COL_X.slice(0, -1).map((x, i) => (x + COL_W[i] + COL_X[i + 1]) / 2),
  FRONT_X + (NAMED_X - FRONT_X) / 2,
]

/* ---------- usher seats ---------- */

/** Front is the row nearest the altar; left and right as seen facing the altar. */
export const SPOTS: { key: SpotKey; name: string }[] = [
  { key: 'FL', name: 'Front row, left end' },
  { key: 'FR', name: 'Front row, right end' },
  { key: 'BL', name: 'Back row, left end' },
  { key: 'BR', name: 'Back row, right end' },
]
export const spotName = (k: SpotKey) => SPOTS.find((s) => s.key === k)!.name
export const hasSpots = (n: number) => n >= 1 && n <= SPOT_SECTION_MAX
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
 * closed: an aisle door kept closed during service (C2, C5, C8).
 * twoway: the public entrance and exit doors on the Nave C wall (P11–P13).
 * workers: workers-only entrance and exit on the Nave A wall (X1, X2).
 * access: P10 on the front aisle, and SE2–SE4 by the stage.
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

const CLOSED_DOORS = [2, 5, 8]
const DOOR_LABEL_LEFT = 52
const DOOR_LABEL_TOP = 76
const DOOR_LABEL_BOTTOM = 1222
const DOOR_LABEL_RIGHT = 1418

export const DOORS: Door[] = [
  // C9 sits on aisle 1, down to C1 on aisle 9
  ...Array.from({ length: AISLE_COUNT }, (_, i): Door => {
    const aisle = i + 1
    const n = AISLE_COUNT + 1 - aisle
    const y = aisleCenterY(aisle)
    const closed = CLOSED_DOORS.includes(n)
    return {
      ref: `C${n}`, kind: closed ? 'closed' : 'aisle', side: 'left', a: y - 22, b: y + 22, label: { x: DOOR_LABEL_LEFT, y },
      note: closed ? `Aisle ${aisle} door, closed during service` : `Aisle ${aisle} door, back wall`,
    }
  }),
  { ref: 'P13', kind: 'twoway', side: 'top', a: 377, b: 417, label: { x: 397, y: DOOR_LABEL_TOP }, note: 'Two-way door, entrance and exit (Nave C)' },
  { ref: 'P12', kind: 'twoway', side: 'top', a: 640, b: 680, label: { x: 660, y: DOOR_LABEL_TOP }, note: 'Two-way door, entrance and exit (Nave C)' },
  { ref: 'P11', kind: 'twoway', side: 'top', a: 902, b: 942, label: { x: 922, y: DOOR_LABEL_TOP }, note: 'Two-way door, entrance and exit (Nave C)' },
  { ref: 'P10', kind: 'access', side: 'top', a: 1034, b: 1074, label: { x: 1054, y: DOOR_LABEL_TOP }, note: 'Access door on the top wall, on the front aisle after Sierra' },
  { ref: 'X1', kind: 'workers', side: 'bottom', a: 505, b: 545, label: { x: 525, y: DOOR_LABEL_BOTTOM }, note: 'Workers only, entrance and exit (Nave A)' },
  { ref: 'X2', kind: 'workers', side: 'bottom', a: 767, b: 807, label: { x: 787, y: DOOR_LABEL_BOTTOM }, note: 'Workers only, entrance and exit (Nave A)' },
  { ref: 'SE3', kind: 'access', side: 'right', a: 104, b: 144, label: { x: DOOR_LABEL_RIGHT, y: 124 }, note: 'Worship team access door, via the walkway' },
  { ref: 'SE4', kind: 'access', side: 'right', a: 418, b: 458, label: { x: DOOR_LABEL_RIGHT, y: 438 }, note: 'Technical access door, beside the technical space' },
  { ref: 'SE2', kind: 'access', side: 'right', a: 1000, b: 1040, label: { x: DOOR_LABEL_RIGHT, y: 1020 }, note: 'Ministers and the Rotunda, by the covered walkway' },
]
export const DOOR_KIND_LABEL: Record<DoorKind, string> = {
  aisle: 'Aisle door',
  closed: 'Aisle door, closed during service',
  twoway: 'Entrance and exit',
  workers: 'Workers only',
  access: 'Access door',
}

/** Door codes from the previous plan, so older zones still land on the right door. */
const LEGACY_DOORS: Record<string, string> = {
  ...Object.fromEntries(Array.from({ length: AISLE_COUNT }, (_, i) => [`D${i + 1}`, `C${AISLE_COUNT - i}`])),
  X3: 'P13', X4: 'P12', X5: 'P11',
  M1: 'SE2', M2: 'SE3', M3: 'P10',
}
/** The door ref for a code such as "C4", "P12" or an older "D4"; undefined when it isn't a door. */
export function doorRefOf(code: string): string | undefined {
  const c = code.trim().toUpperCase()
  const ref = LEGACY_DOORS[c] ?? c
  return DOORS.some((d) => d.ref === ref) ? ref : undefined
}

export function doorRect(d: Door): Rect {
  const B = PLAN.building
  const depth = (d.b - d.a) / 2 + 6
  if (d.side === 'top') return { x: d.a, y: B.y - 6, w: d.b - d.a, h: depth }
  if (d.side === 'bottom') return { x: d.a, y: B.y + B.h - depth + 6, w: d.b - d.a, h: depth }
  if (d.side === 'left') return { x: B.x - 6, y: d.a, w: depth, h: d.b - d.a }
  return { x: B.x + B.w - depth + 6, y: d.a, w: depth, h: d.b - d.a }
}

/* ---------- areas: the stage side, the desks in the hall, the front aisle ---------- */

export interface PlanArea {
  ref: string
  name: string
  rect: Rect
  note?: string
  /** other names a zone may use for this area */
  aliases?: string[]
}

export const AREAS: PlanArea[] = [
  { ref: 'council', name: 'Councillors', rect: { x: 1192, y: 145, w: 185, h: 92 }, note: '120 chairs (60 + 60), behind the worship team, 10 ft apart', aliases: ['Councillors Area', 'Councilors'] },
  { ref: 'worship', name: 'Worship Team', rect: { x: 1192, y: 270, w: 185, h: 132 }, note: '150 chairs (75 + 75)' },
  { ref: 'tech', name: 'Technical Space', rect: { x: 1192, y: 415, w: 185, h: 46 }, note: 'Stage, beside the altar, by door SE4' },
  { ref: 'altar', name: 'Altar & Pulpit', rect: { x: 1192, y: 470, w: 170, h: 355 }, note: 'Pulpit and platform, 30 m wide (Nave B)', aliases: ['Altar', 'Altar and Pulpit'] },
  { ref: 'screen', name: 'Crane Screen', rect: { x: 1365, y: 470, w: 15, h: 355 }, note: 'Crane and screen, in the 1 m strip behind the stage' },
  { ref: 'walkway', name: 'Covered Walkway', rect: { x: 1192, y: 1005, w: 189, h: 35 }, note: 'Covered, screened walkway inside, from door SE2 to the stage' },
  { ref: 'reserve', name: 'Stage Reserve', rect: { x: 1192, y: 1052, w: 170, h: 112 } },
  { ref: 'apostle', name: "Apostle's Chairs", rect: { x: 1170, y: 555, w: 18, h: 210 }, note: 'Nine special chairs for the Apostle and guest ministers', aliases: ['Apostle and Guest Ministers'] },
  { ref: 'protocol', name: 'Protocol Row', rect: { x: 1118, y: 593, w: 12, h: 100 }, note: 'ADCs and PAs, the front row of Delta', aliases: ['ADCs & PAs', 'ADCs and PAs'] },
  { ref: 'media1', name: 'Media Desk 1', rect: { x: 500, y: 569, w: 46, h: 157 }, note: 'Media and videography, by Sections 42–43 and 54–55' },
  { ref: 'techdesk', name: 'Technical Desk', rect: { x: 759, y: 569, w: 25, h: 157 }, note: 'Technical, by Sections 18–19 and 30–31' },
  { ref: 'media2', name: 'Media Desk 2', rect: { x: 787, y: 569, w: 25, h: 157 }, note: 'Media and videography, by Sections 18–19' },
  { ref: 'front', name: 'Front Aisle', rect: FRONT_AISLE, note: 'Between Sections 1–12 and the named front sections, with door P10' },
]

export const NAVES = [
  { name: 'NAVE C', size: '30 m', y0: PLAN.building.y, y1: tentLineY(3) },
  { name: 'NAVE B', size: '30 m', y0: tentLineY(3), y1: tentLineY(7) },
  { name: 'NAVE A', size: '30 m', y0: tentLineY(7), y1: PLAN.building.y + PLAN.building.h },
]

/* ---------- section types ---------- */

export const INTERNATIONAL = [8, 9, 10, 20, 21, 22]
const BY_MEDIA = [42, 43, 54, 55]
const BY_TECH = [18, 19, 30, 31]
export type SectionStyle = 'standard' | 'international'
export function sectionStyle(n: number): SectionStyle {
  return INTERNATIONAL.includes(n) ? 'international' : 'standard'
}
/** The outer sections by the exit doors (top and bottom rows), dashed on the plan. */
export const isOuterSection = (n: number) => {
  const { row } = sectionCell(n)
  return row === 0 || row === ROWS - 1
}
export function sectionNote(n: number) {
  const parts = [
    INTERNATIONAL.includes(n) ? 'International guests' : undefined,
    BY_MEDIA.includes(n) ? 'Beside the media desk' : undefined,
    BY_TECH.includes(n) ? 'Beside the technical and media desks' : undefined,
    n > SPOT_SECTION_MAX ? 'Back column' : undefined,
    isOuterSection(n) ? 'Outer section by the exit doors' : undefined,
  ]
  return parts.filter(Boolean).join(', ') || undefined
}
const naveAt = (y: number) => NAVES.find((v) => y >= v.y0 && y < v.y1)?.name.replace('NAVE', 'Nave') ?? 'Nave B'
export function naveOf(n: number) {
  const r = sectionRect(n)
  return naveAt(r.y + r.h / 2)
}

/* ---------- linking roster zones to the plan ---------- */

const squash = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * The plan reference for a zone: S1–S84, a named section (SIERRA…XRAY),
 * A1–A9, a door code, or an area ref. Zones named like the plan ("Section 14",
 * "Sierra", "Aisle 2", "Door C4") are placed even without an explicit mapRef,
 * so zones added by an admin show up too. Door codes from the previous plan
 * (D1–D9, X3–X5, M1–M3) are moved to their new doors.
 */
export function zoneRef(zone: Pick<Zone, 'name' | 'mapRef'>): string | undefined {
  if (zone.mapRef) {
    const m = zone.mapRef.trim()
    const s = m.match(/^S(\d{1,2})$/i)
    if (s) return +s[1] >= 1 && +s[1] <= SECTION_COUNT ? `S${+s[1]}` : undefined
    const named = namedOfRef(squash(m))
    if (named) return named.ref
    const door = doorRefOf(m)
    if (door) return door
    return m
  }
  const name = zone.name.trim()
  let m = name.match(/^sec(?:tion)?\.?\s*(\d{1,2})$/i)
  if (m && +m[1] >= 1 && +m[1] <= SECTION_COUNT) return `S${+m[1]}`
  m = name.match(/^aisle\s*(\d)$/i)
  if (m && +m[1] >= 1 && +m[1] <= AISLE_COUNT) return `A${+m[1]}`
  const bare = squash(name.replace(/^(?:section|sec\.?)\s+/i, '').replace(/\s+section$/i, ''))
  const named = namedOfRef(bare)
  if (named) return named.ref
  m = name.match(/^(?:door\s*)?([A-Z]{1,2}\d{1,2})\b/i)
  if (m) {
    const door = doorRefOf(m[1])
    if (door) return door
  }
  const key = name.toLowerCase()
  const area = AREAS.find((a) => a.name.toLowerCase() === key || a.aliases?.some((x) => x.toLowerCase() === key))
  return area?.ref
}

export const sectionOfRef = (ref: string | undefined) => (ref && /^S\d+$/.test(ref) ? +ref.slice(1) : undefined)

export function refRect(ref: string): Rect | undefined {
  const n = sectionOfRef(ref)
  if (n) return sectionRect(n)
  if (/^A\d$/.test(ref)) return aisleRect(+ref.slice(1))
  const named = namedOfRef(ref)
  if (named) return named.rect
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
  const named = namedOfRef(ref)
  if (named) return [named.note, 'Named front section, 5 rows', naveAt(named.rect.y + named.rect.h / 2)].filter(Boolean).join(' · ')
  if (/^A\d$/.test(ref)) {
    const a = +ref.slice(1)
    return `Across the hall, door C${AISLE_COUNT + 1 - a} on the back wall${LANE_AISLES.includes(a) ? ' · Nave B central lane' : ''}`
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
