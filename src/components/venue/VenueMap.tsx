import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Crosshair, Maximize2, Minus, Plus, RotateCw, Search } from 'lucide-react'
import type { Position, Zone } from '@/data/types'
import {
  AISLE_BADGE_X, AISLE_COUNT, AREAS, DOORS, DOOR_KIND_LABEL, FRONT_AISLE, LANE_AISLES, NAMED_SECTIONS, NAVES, PILLAR_X, PLAN, SECTION_COUNT, SPOTS, SPOT_SECTION_MAX, TENT_ROWS,
  aisleCenterY, aisleLabelCols, aisleRects, colCenterX, doorRect, doorRefOf, isOuterSection, namedOfRef, nearestEntrance, refRect, sectionRect, sectionStyle,
  spotPoint, tentLineY, zoneNote, zoneRef,
  type Door, type NamedStyle, type Rect,
} from '@/data/venue'
import { cn } from '@/lib/utils'

/**
 * The arena floor plan as a tappable schematic: 84 numbered seating sections
 * (with four usher seats on Sections 1–72), 11 named front sections (Sierra
 * down to Xray), the front aisle, aisles 1–9, the tent lines, in-hall media &
 * technical desks, doors (C1–C9, P10–P13, X1–X2, SE2–SE4), and the altar-side
 * areas (Councillors, Worship Team, Technical Space, Altar, Covered Walkway,
 * Stage Reserve).
 *
 * Rendered identically for Admins, Coordinators, Leaders, and Members using the
 * official floor plan schematic and legend as the single source of truth.
 */

export type MapMode = 'locate' | 'coverage' | 'plain'

export interface ZoneInfo {
  assigned?: number
  required?: number
  coverage?: number
  leaders?: string[]
  coordinators?: string[]
}

interface Props {
  zones: Zone[]
  mode?: MapMode
  highlightZoneId?: string
  selectedZoneId?: string
  info?: Record<string, ZoneInfo>
  onSelect?: (zoneId: string) => void
  className?: string
  compact?: boolean
  /** leave out the colour key under the plan */
  hideLegend?: boolean
  pinLabel?: string
  /** positions of these zones; positions with a `spot` are drawn as usher spots */
  positions?: Position[]
  /** who stands at each spot, by position id */
  occupants?: Record<string, string>
  /** in locate mode, the usher's own spot */
  highlightPositionId?: string
  /** tap on an usher spot */
  onSelectSpot?: (zoneId: string, positionId: string) => void
  /** open spots whose usher said they can't make it: position id → their name */
  uncovered?: Record<string, string>
}

/* ---------- orientation ---------- */

const XR = PLAN.view.x * 2 + PLAN.view.w
const B_MID_X = PLAN.building.x + PLAN.building.w / 2
const B_MID_Y = PLAN.building.y + PLAN.building.h / 2 // rotation pivot so the turned plan keeps the same margins

type Orient = 'landscape' | 'portrait'
function project(o: Orient) {
  const rect = (r: Rect): Rect => (o === 'landscape' ? r : { x: r.y, y: XR - r.x - r.w, w: r.h, h: r.w })
  const pt = (x: number, y: number) => (o === 'landscape' ? { x, y } : { x: y, y: XR - x })
  return { rect, pt }
}

/* ---------- colours (from the official schematic & legend) ---------- */

const PLAIN: Record<ReturnType<typeof sectionStyle>, { fill: string; edge: string }> = {
  standard: { fill: '#2F5DD3', edge: '#1E3F9E' },
  international: { fill: '#34A853', edge: '#1E7A39' },
}
const NAMED_PLAIN: Record<NamedStyle, { fill: string; edge: string }> = {
  named: { fill: '#2F5DD3', edge: '#1E3F9E' },
  lady: { fill: '#E5486F', edge: '#B3204A' },
  protocol: { fill: '#2F5DD3', edge: '#1E3F9E' },
  contemporaries: { fill: '#3A3D44', edge: '#15171B' },
  international: { fill: '#34A853', edge: '#1E7A39' },
}
const DOOR_COLOR: Record<Door['kind'], string> = {
  aisle: '#2E9E5B',
  closed: '#F28C1B',
  twoway: '#D8263A',
  workers: '#0F6B58',
  access: '#7C3AED',
}
const AREA_COLOR: Record<string, { fill: string; edge: string; text: string }> = {
  council: { fill: '#FDF6D8', edge: '#C69214', text: '#7A5206' },
  worship: { fill: '#E8F7EE', edge: '#2BA457', text: '#166534' },
  tech: { fill: '#FFFFFF', edge: '#111318', text: '#111318' },
  altar: { fill: '#FDECC8', edge: '#E89B3C', text: '#8A4208' },
  screen: { fill: '#17A2B8', edge: '#0F1B33', text: '#0F1B33' },
  walkway: { fill: '#EFE6FF', edge: '#7C3AED', text: '#5B21B6' },
  reserve: { fill: '#E8E4FB', edge: '#7C3AED', text: '#4B4FB0' },
  apostle: { fill: '#EFE6FF', edge: '#7C3AED', text: '#6D28D9' },
  protocol: { fill: '#BCEEFF', edge: '#17A2B8', text: '#0E7490' },
  media1: { fill: '#FFF3E2', edge: '#E89B3C', text: '#D97706' },
  techdesk: { fill: '#FFFFFF', edge: '#111318', text: '#111318' },
  media2: { fill: '#FFF3E2', edge: '#E89B3C', text: '#D97706' },
  front: { fill: '#C5D3F0', edge: '#93ADE0', text: '#2B4AA6' },
}

/* ---------- pan & zoom ---------- */

type View = { k: number; x: number; y: number }
const MAX_K = 5

function usePanZoom(box: React.RefObject<HTMLDivElement | null>) {
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  const moved = useRef(false)

  const clamp = useCallback((v: View): View => {
    const el = box.current
    if (!el) return v
    const w = el.clientWidth
    const h = el.clientHeight
    const k = Math.min(MAX_K, Math.max(1, v.k))
    return { k, x: Math.min(0, Math.max(w - w * k, v.x)), y: Math.min(0, Math.max(h - h * k, v.y)) }
  }, [box])

  const zoomAt = useCallback((k: number, cx: number, cy: number) => {
    const v = viewRef.current
    const nk = Math.min(MAX_K, Math.max(1, k))
    setView(clamp({ k: nk, x: cx - ((cx - v.x) * nk) / v.k, y: cy - ((cy - v.y) * nk) / v.k }))
  }, [clamp])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const pts = new Map<number, { x: number; y: number }>()
    let start: { v: View; d: number; cx: number; cy: number; x: number; y: number } | null = null
    let lastTap = 0
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const begin = () => {
      const p = [...pts.values()]
      const cx = p.reduce((s, q) => s + q.x, 0) / p.length
      const cy = p.reduce((s, q) => s + q.y, 0) / p.length
      const d = p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0
      start = { v: viewRef.current, d, cx, cy, x: cx, y: cy }
    }
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (pts.size === 0) moved.current = false
      pts.set(e.pointerId, local(e))
      begin()
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', cancel)
    }
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId) || !start) return
      pts.set(e.pointerId, local(e))
      const p = [...pts.values()]
      const cx = p.reduce((s, q) => s + q.x, 0) / p.length
      const cy = p.reduce((s, q) => s + q.y, 0) / p.length
      if (Math.hypot(cx - start.x, cy - start.y) > 6 || p.length > 1) moved.current = true
      if (p.length > 1 && start.d > 0) {
        const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)
        const k = Math.min(MAX_K, Math.max(1, (start.v.k * d) / start.d))
        setView(clamp({ k, x: cx - ((start.cx - start.v.x) * k) / start.v.k, y: cy - ((start.cy - start.v.y) * k) / start.v.k }))
      } else if (start.v.k > 1) {
        setView(clamp({ k: start.v.k, x: start.v.x + cx - start.cx, y: start.v.y + cy - start.cy }))
      }
    }
    const end = (e: PointerEvent) => {
      pts.delete(e.pointerId)
      if (pts.size) begin()
      else {
        start = null
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', cancel)
      }
    }
    const up = (e: PointerEvent) => {
      const wasTap = !moved.current && pts.size === 1
      const at = local(e)
      end(e)
      if (wasTap && e.pointerType !== 'mouse') {
        const now = Date.now()
        if (now - lastTap < 300) {
          const v = viewRef.current
          zoomAt(v.k >= 3 ? 1 : v.k * 2, at.x, at.y)
          lastTap = 0
        } else lastTap = now
      }
    }
    const cancel = (e: PointerEvent) => end(e)
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(viewRef.current.k * Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('wheel', wheel)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [box, clamp, zoomAt])

  return { view, setView, clamp, zoomAt, moved }
}

/* ---------- component ---------- */

export function VenueMap({ zones, mode = 'plain', highlightZoneId, selectedZoneId, info = {}, onSelect, className, compact, hideLegend, pinLabel = 'You', positions, occupants, highlightPositionId, onSelectSpot, uncovered }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [manualOrient, setManualOrient] = useState<Orient | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [hoverSpot, setHoverSpot] = useState<string | null>(null)
  const [find, setFind] = useState('')
  const { view, setView, clamp, zoomAt, moved } = usePanZoom(box)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const orient: Orient = manualOrient ?? (width && width < 640 ? 'portrait' : 'landscape')
  const P = useMemo(() => project(orient), [orient])
  const vb = P.rect(PLAN.view)
  useEffect(() => setView({ k: 1, x: 0, y: 0 }), [orient, setView])

  /** plan ref → zone */
  const { byRef, unplaced } = useMemo(() => {
    const byRef = new Map<string, Zone>()
    const unplaced: Zone[] = []
    for (const z of [...zones].sort((a, b) => a.order - b.order)) {
      const ref = zoneRef(z)
      if (ref && !byRef.has(ref)) byRef.set(ref, z)
      else unplaced.push(z)
    }
    return { byRef, unplaced }
  }, [zones])
  const refOf = useMemo(() => new Map([...byRef.entries()].map(([r, z]) => [z.id, r])), [byRef])

  /**
   * Usher seats: all 72 sections (1–72, including 5, 6, 7, 17, 18) ALWAYS have
   * 4 corner usher seats (FL, FR, BL, BR) as shown on the schematic. If the
   * event's positions list has a matching position for that corner, we link it.
   */
  const spots = useMemo(() => {
    const posByZoneSpot = new Map<string, Position>()
    const firstPosByZone = new Map<string, Position>()
    for (const p of positions ?? []) {
      if (!firstPosByZone.has(p.zoneId)) firstPosByZone.set(p.zoneId, p)
      const spotKey = p.spot ?? SPOTS.find((s) => s.name.toLowerCase() === p.name.trim().toLowerCase())?.key
      if (spotKey) posByZoneSpot.set(`${p.zoneId}_${spotKey}`, p)
    }
    const out: {
      key: string
      positionId?: string
      fallbackPositionId?: string
      zoneId?: string
      zoneName: string
      name: string
      x: number
      y: number
    }[] = []
    for (let n = 1; n <= SPOT_SECTION_MAX; n++) {
      const ref = `S${n}`
      const z = byRef.get(ref)
      const zoneName = z?.name ?? `Section ${n}`
      const fallback = z ? firstPosByZone.get(z.id) : undefined
      for (const sp of SPOTS) {
        const p = z ? posByZoneSpot.get(`${z.id}_${sp.key}`) : undefined
        out.push({
          key: p?.id ?? `${ref}_${sp.key}`,
          positionId: p?.id,
          fallbackPositionId: fallback?.id,
          zoneId: z?.id,
          zoneName,
          name: p?.name ?? sp.name,
          ...spotPoint(n, sp.key),
        })
      }
    }
    return out
  }, [positions, byRef])

  const mySpot = highlightPositionId ? spots.find((s) => s.positionId === highlightPositionId) : undefined

  const focusId = highlightZoneId ?? selectedZoneId
  const interactive = !!onSelect

  /** zoom so a plan rect sits in the middle of the view */
  const zoomToRef = useCallback((ref: string, k = 2.6) => {
    const r = refRect(ref)
    const el = box.current
    if (!r || !el) return
    const s = P.rect(r)
    const scale = el.clientWidth / vb.w
    const cx = (s.x + s.w / 2 - vb.x) * scale
    const cy = (s.y + s.h / 2 - vb.y) * scale
    setView(clamp({ k, x: el.clientWidth / 2 - cx * k, y: el.clientHeight / 2 - cy * k }))
  }, [P, vb.w, vb.x, vb.y, clamp, setView])

  const zoomToPoint = useCallback((x: number, y: number, k = 3) => {
    const el = box.current
    if (!el) return
    const s = P.pt(x, y)
    const scale = el.clientWidth / vb.w
    setView(clamp({ k, x: el.clientWidth / 2 - (s.x - vb.x) * scale * k, y: el.clientHeight / 2 - (s.y - vb.y) * scale * k }))
  }, [P, vb.w, vb.x, vb.y, clamp, setView])

  const select = (ref: string) => {
    if (moved.current) return
    const z = byRef.get(ref)
    if (z) onSelect?.(z.id)
  }

  const goFind = () => {
    const raw = find.trim()
    if (!raw) return
    const q = raw.toUpperCase().replace(/^SECTION\s*/, '').replace(/^SEC\.?\s*/, '').replace(/^DOOR\s*/, '').replace(/^AISLE\s*/, 'A')
    let ref: string | undefined
    if (/^S?\d{1,2}$/.test(q)) {
      const n = +q.replace(/^S/, '')
      if (n >= 1 && n <= SECTION_COUNT) ref = `S${n}`
    } else if (/^A[1-9]$/.test(q)) {
      ref = q
    } else if (namedOfRef(q)) {
      ref = q
    } else if (doorRefOf(q)) {
      ref = doorRefOf(q)
    } else {
      ref = zoneRef({ name: raw })
    }
    if (!ref) return
    zoomToRef(ref)
    const z = byRef.get(ref)
    if (z) onSelect?.(z.id)
    setFind('')
  }

  /* --- look of each plan item --- */
  const zoneFor = (ref: string) => byRef.get(ref)
  const isFocus = (ref: string) => !!focusId && refOf.get(focusId) === ref

  const hit = (ref: string, label: string) => {
    const z = zoneFor(ref)
    if (!z || !interactive) return { onMouseEnter: () => setHover(ref), onMouseLeave: () => setHover((h) => (h === ref ? null : h)) }
    const zi = info[z.id]
    return {
      role: 'button',
      tabIndex: 0,
      'aria-label': `${label}${zi?.assigned != null ? `, ${zi.assigned} of ${zi.required ?? 0} ushers` : ''}`,
      'aria-pressed': isFocus(ref),
      onClick: () => select(ref),
      onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect?.(z.id)),
      onMouseEnter: () => setHover(ref),
      onMouseLeave: () => setHover((h) => (h === ref ? null : h)),
      onFocus: () => setHover(ref),
      onBlur: () => setHover(null),
      className: 'cursor-pointer outline-none focus-visible:[&>*:first-child]:stroke-[#111827]',
    }
  }

  const R = (r: Rect, props: React.SVGProps<SVGRectElement>) => {
    const s = P.rect(r)
    return <rect x={s.x} y={s.y} width={s.w} height={s.h} {...props} />
  }

  const hoveredSpot = hoverSpot ? spots.find((s) => s.key === hoverSpot) : undefined
  const activeRef = hover ?? (focusId ? refOf.get(focusId) : undefined)
  const activeZone = activeRef ? zoneFor(activeRef) : undefined
  const highlightRef = highlightZoneId ? refOf.get(highlightZoneId) : undefined
  const entrance = mode === 'locate' && highlightRef && !DOORS.some((d) => d.ref === highlightRef) ? nearestEntrance(highlightRef, mySpot) : undefined

  const IN_HALL_DESK_REFS = ['media1', 'techdesk', 'media2']
  const stageAreas = AREAS.filter((a) => !IN_HALL_DESK_REFS.includes(a.ref) && a.ref !== 'front')
  const deskAreas = AREAS.filter((a) => IN_HALL_DESK_REFS.includes(a.ref))

  return (
    <div className={cn('relative', className)}>
      <div
        ref={box}
        className="relative overflow-hidden rounded-2xl bg-[#F4F6FA] ring-1 ring-line"
        style={{ touchAction: view.k > 1 ? 'none' : 'pan-y', aspectRatio: `${vb.w} / ${vb.h}` }}
      >
        <div style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: '0 0', transition: 'transform 60ms linear' }} className={cn('h-full w-full', view.k > 1 && 'cursor-grab active:cursor-grabbing')}>
          <svg
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            className="block h-full w-full select-none"
            role="group"
            aria-label="Arena floor plan: 84 numbered seating sections, 11 named front sections, aisles 1 to 9, doors and the altar"
            style={{ fontFamily: 'Manrope, ui-sans-serif, system-ui, sans-serif' }}
          >
            <defs>
              <pattern id="grm-seats" width="10.2" height="6.5" patternUnits="userSpaceOnUse" patternTransform={orient === 'portrait' ? 'rotate(90)' : undefined}>
                <path d="M9.7 0V6.5M0 6H10.2" stroke="#FFFFFF" strokeOpacity=".55" strokeWidth="1" />
              </pattern>
              <pattern id="grm-seats-named" width="11.6" height="6.5" patternUnits="userSpaceOnUse" patternTransform={orient === 'portrait' ? 'rotate(90)' : undefined}>
                <path d="M11.1 0V6.5M0 6H11.6" stroke="#FFFFFF" strokeOpacity=".55" strokeWidth="1" />
              </pattern>
              <pattern id="grm-seats-stage" width="8.5" height="6" patternUnits="userSpaceOnUse" patternTransform={orient === 'portrait' ? 'rotate(90)' : undefined}>
                <path d="M8 0V6M0 5.5H8.5" stroke="#FFFFFF" strokeOpacity=".6" strokeWidth="0.9" />
              </pattern>
            </defs>

            {/* overall dimensions */}
            <g pointerEvents="none">
              {(() => {
                const B = PLAN.building
                const a = P.pt(B.x, 24), b = P.pt(B.x + B.w, 24)
                const c = P.pt(14, B.y), d = P.pt(14, B.y + B.h)
                const tick = (x: number, y: number, vertical: boolean) => {
                  const q = vertical ? P.pt(x, y - 7) : P.pt(x - 7, y)
                  const r = vertical ? P.pt(x, y + 7) : P.pt(x + 7, y)
                  return <line key={`${x}-${y}`} x1={q.x} y1={q.y} x2={r.x} y2={r.y} stroke="#6B7280" strokeWidth={2} />
                }
                return (
                  <>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#9AA3B5" strokeWidth={1.5} />
                    {tick(B.x, 24, true)}{tick(B.x + B.w, 24, true)}
                    <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} stroke="#9AA3B5" strokeWidth={1.5} />
                    {tick(14, B.y, false)}{tick(14, B.y + B.h, false)}
                  </>
                )
              })()}
              {(() => { const p = P.pt(B_MID_X, 24); return <rect x={p.x - 34} y={p.y - 11} width={68} height={22} fill="#F4F6FA" transform={orient === 'portrait' ? `rotate(-90 ${p.x} ${p.y})` : undefined} /> })()}
              <Txt o={orient} x={B_MID_X} y={24} size={14} weight={600} fill="#374151" port={-90}>105 m</Txt>
              {(() => { const p = P.pt(14, B_MID_Y); return <rect x={p.x - 11} y={p.y - 26} width={22} height={52} fill="#F4F6FA" transform={orient === 'portrait' ? `rotate(-90 ${p.x} ${p.y})` : undefined} /> })()}
              <Txt o={orient} x={14} y={B_MID_Y} size={14} weight={600} fill="#374151" land={-90}>90 m</Txt>
            </g>

            {/* building & seating pad */}
            {R(PLAN.building, { fill: '#FFFFFF', stroke: '#111318', strokeWidth: 6 })}
            {R(PLAN.seating, { fill: '#E3E8F2', rx: 10 })}

            {/* front aisle strip between Sections 1–12 and named front sections */}
            {(() => {
              const ref = 'front'
              const focus = isFocus(ref)
              return (
                <g {...hit(ref, 'Front Aisle')}>
                  {/* connection up to door P10 */}
                  {R({ x: FRONT_AISLE.x - 4, y: PLAN.building.y + 3, w: FRONT_AISLE.w + 8, h: FRONT_AISLE.y - PLAN.building.y + 4 }, { fill: '#C5D3F0', pointerEvents: 'none' })}
                  {R(FRONT_AISLE, { fill: '#C5D3F0', stroke: focus || hover === ref ? '#111827' : 'none', strokeWidth: 2.5 })}
                  <Txt o={orient} x={FRONT_AISLE.x + FRONT_AISLE.w / 2} y={642} size={11.5} weight={800} fill="#2B4AA6" land={90} port={0} spacing={0.8}>FRONT AISLE</Txt>
                </g>
              )
            })()}

            {/* aisles 1–9 */}
            {Array.from({ length: AISLE_COUNT }, (_, i) => i + 1).map((n) => {
              const ref = `A${n}`
              const rects = aisleRects(n)
              const focus = isFocus(ref)
              const lane = LANE_AISLES.includes(n)
              const fill = lane ? '#A9BDEB' : '#C5D3F0'
              const cy = aisleCenterY(n)
              return (
                <g key={ref} {...hit(ref, `Aisle ${n}`)}>
                  {rects.map((r, i) => (
                    <g key={i}>
                      {R({ x: r.x, y: r.y - 4, w: r.w, h: r.h + 8 }, { fill: 'transparent' })}
                      {R({ x: r.x, y: r.y + 1, w: r.w, h: r.h - 2 }, { fill, stroke: focus || hover === ref ? '#111827' : 'none', strokeWidth: 3 })}
                    </g>
                  ))}
                  {aisleLabelCols(n).map((col) => (
                    <Txt o={orient} key={col} x={colCenterX(col, n)} y={cy} size={11} fill="#2B4AA6" land={0} port={-90} spacing={0.4}>AISLE {n}</Txt>
                  ))}
                  {(() => {
                    const p = P.pt(AISLE_BADGE_X, cy)
                    return (
                      <g>
                        <circle cx={p.x} cy={p.y} r={20} fill="transparent" />
                        <circle cx={p.x} cy={p.y} r={11.5} fill="#0B0D12" stroke="#FFFFFF" strokeWidth={2} />
                      </g>
                    )
                  })()}
                  <Txt o={orient} x={AISLE_BADGE_X} y={cy} size={12.5} weight={800} fill="#FFFFFF">{n}</Txt>
                </g>
              )
            })}

            {/* tent lines: a chair column removed for the aluminium pillars, not an aisle */}
            {TENT_ROWS.map((row) => {
              const y = tentLineY(row)
              const a = P.pt(PILLAR_X[0], y)
              const b = P.pt(PILLAR_X[PILLAR_X.length - 1], y)
              return (
                <g key={row} pointerEvents="none">
                  {R({ x: PLAN.seating.x, y: y - 10, w: PLAN.seating.w, h: 20 }, { fill: '#EEF1F6' })}
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2A2E36" strokeWidth="1.5" strokeDasharray="7 6" />
                  {PILLAR_X.map((x) => {
                    const p = P.pt(x, y)
                    return (
                      <g key={x}>
                        <rect x={p.x - 8} y={p.y - 8} width={16} height={16} rx={2} fill="#D9DEE8" stroke="#2A2E36" strokeWidth={1.5} />
                        <rect x={p.x - 5} y={p.y - 4} width={4} height={8} fill="#2A2E36" />
                        <rect x={p.x + 1} y={p.y - 4} width={4} height={8} fill="#2A2E36" />
                      </g>
                    )
                  })}
                </g>
              )
            })}

            {/* numbered sections 1–84 */}
            {Array.from({ length: SECTION_COUNT }, (_, i) => i + 1).map((n) => {
              const ref = `S${n}`
              const r = sectionRect(n)
              const col = PLAIN[sectionStyle(n)]
              const focus = isFocus(ref)
              const edgeOn = focus || hover === ref
              const cx = r.x + r.w / 2
              const cy = r.y + r.h / 2
              const narrow = n > SPOT_SECTION_MAX
              const rad = narrow ? 14.5 : 16.5
              return (
                <g key={ref} {...hit(ref, `Section ${n}`)}>
                  {isOuterSection(n) && R({ x: r.x - 3, y: r.y - 4, w: r.w + 6, h: r.h + 8 }, { fill: 'none', stroke: '#F08A1C', strokeWidth: 1.6, strokeDasharray: '5 4', pointerEvents: 'none' })}
                  {R(r, { fill: col.fill, stroke: edgeOn ? '#111827' : col.edge, strokeWidth: edgeOn ? 4 : 1.5, rx: 2 })}
                  {R({ x: r.x + 2.5, y: r.y + 2.5, w: r.w - 5, h: r.h - 5 }, { fill: 'url(#grm-seats)', pointerEvents: 'none' })}
                  {(() => {
                    const p = P.pt(cx, cy)
                    return <circle cx={p.x} cy={p.y} r={rad} fill="#0B0D12" stroke="#FFFFFF" strokeWidth={1.5} pointerEvents="none" />
                  })()}
                  <Txt o={orient} x={cx} y={cy} size={narrow ? 15 : 16.5} weight={800} fill="#FFFFFF">{n}</Txt>
                </g>
              )
            })}

            {/* in-hall media & technical desks */}
            {deskAreas.map((a) => {
              const focus = isFocus(a.ref)
              const c = AREA_COLOR[a.ref]
              const r = a.rect
              const cx = r.x + r.w / 2
              const cy = r.y + r.h / 2
              const edge = focus || hover === a.ref ? '#111827' : c.edge
              const isMedia = a.ref === 'media1' || a.ref === 'media2'
              const wide = a.ref === 'media1'
              return (
                <g key={a.ref} {...hit(a.ref, a.name)}>
                  {R(r, { fill: c.fill, stroke: edge, strokeWidth: focus || hover === a.ref ? 3.5 : 2, rx: 6 })}
                  {isMedia ? (
                    <>
                      <Txt o={orient} x={wide ? cx - 6 : cx - 4} y={cy} size={wide ? 16 : 12.5} weight={800} land={-90} port={0} fill="#E8831A" spacing={0.5}>MEDIA</Txt>
                      <Txt o={orient} x={wide ? cx + 9 : cx + 6} y={cy} size={wide ? 10 : 8} weight={500} land={-90} port={0} fill="#4B5263">videography</Txt>
                    </>
                  ) : (
                    <Txt o={orient} x={cx} y={cy} size={13} weight={800} land={-90} port={0} fill="#111318" spacing={0.5}>TECHNICAL</Txt>
                  )}
                </g>
              )
            })}

            {/* named front sections (5 rows each: Sierra down to Xray) */}
            {NAMED_SECTIONS.map((ns) => {
              const r = ns.rect
              const col = NAMED_PLAIN[ns.style]
              const focus = isFocus(ns.ref)
              const edgeOn = focus || hover === ns.ref
              const seatW = 58
              const seatRect: Rect = { x: r.x, y: r.y, w: seatW, h: r.h }
              const tagRect: Rect = { x: r.x + seatW + 2, y: r.y + 5, w: 18, h: r.h - 10 }
              const cy = r.y + r.h / 2
              const tagCx = tagRect.x + tagRect.w / 2
              return (
                <g key={ns.ref} {...hit(ns.ref, `${ns.name} Section`)}>
                  {R(seatRect, { fill: col.fill, stroke: edgeOn ? '#111827' : col.edge, strokeWidth: edgeOn ? 3.5 : 1.5, rx: 2 })}
                  {R({ x: seatRect.x + 2, y: seatRect.y + 2, w: seatRect.w - 4, h: seatRect.h - 4 }, { fill: 'url(#grm-seats-named)', pointerEvents: 'none' })}

                  {/* special front-row strips & pills on Echo, Delta, Charlie, Bravo */}
                  {ns.ref === 'ECHO' && (
                    <>
                      {R({ x: seatRect.x + seatRect.w - 17, y: r.y + 6, w: 15, h: r.h - 12 }, { fill: '#FFFFFF', stroke: '#B3204A', strokeWidth: 1.2, rx: 6, pointerEvents: 'none' })}
                      <Txt o={orient} x={seatRect.x + seatRect.w - 9.5} y={cy} size={9.5} weight={700} land={90} port={0} fill="#B3204A">Lady Sandra’s</Txt>
                    </>
                  )}
                  {ns.ref === 'DELTA' && (
                    <>
                      {R({ x: seatRect.x + seatRect.w - 12, y: r.y + 1.5, w: 11, h: r.h - 3 }, { fill: '#BCEEFF', stroke: '#17A2B8', strokeWidth: 1.5, rx: 1.5, pointerEvents: 'none' })}
                      {R({ x: seatRect.x + seatRect.w - 12, y: r.y + 2, w: 11, h: r.h - 4 }, { fill: 'url(#grm-seats-named)', pointerEvents: 'none' })}
                    </>
                  )}
                  {ns.ref === 'CHARLIE' && (
                    <>
                      {R({ x: seatRect.x + seatRect.w - 22, y: r.y + 5, w: 20, h: r.h - 10 }, { fill: '#FFFFFF', stroke: '#15171B', strokeWidth: 1.2, rx: 6, pointerEvents: 'none' })}
                      <Txt o={orient} x={seatRect.x + seatRect.w - 8.5} y={cy} size={8.5} weight={700} land={90} port={0} fill="#111318">Select</Txt>
                      <Txt o={orient} x={seatRect.x + seatRect.w - 16} y={cy} size={8.5} weight={700} land={90} port={0} fill="#111318">Contemporaries</Txt>
                    </>
                  )}
                  {ns.ref === 'BRAVO' && (
                    <>
                      {R({ x: seatRect.x + seatRect.w - 12, y: r.y + 1.5, w: 11, h: r.h - 3 }, { fill: '#CCF0D6', stroke: '#1E7A39', strokeWidth: 1.2, rx: 1.5, pointerEvents: 'none' })}
                      {R({ x: seatRect.x + seatRect.w - 22, y: r.y + 4, w: 20, h: r.h - 8 }, { fill: '#FFFFFF', stroke: '#1E7A39', strokeWidth: 1.2, rx: 6, pointerEvents: 'none' })}
                      <Txt o={orient} x={seatRect.x + seatRect.w - 8.5} y={cy} size={8.5} weight={800} land={90} port={0} fill="#14532D">MPFs &</Txt>
                      <Txt o={orient} x={seatRect.x + seatRect.w - 16} y={cy} size={8.5} weight={800} land={90} port={0} fill="#14532D">Leaders</Txt>
                    </>
                  )}

                  {/* black vertical section name tag */}
                  {R(tagRect, { fill: '#0B0D12', stroke: edgeOn ? '#111827' : '#FFFFFF', strokeWidth: 1, rx: 4 })}
                  <Txt o={orient} x={tagCx} y={cy} size={9.5} weight={800} land={90} port={0} fill="#FFFFFF" spacing={0.4}>{ns.ref}</Txt>

                  {/* GLASS tag beside DELTA */}
                  {ns.ref === 'DELTA' && (
                    <>
                      {R({ x: tagRect.x + tagRect.w + 2, y: r.y + 22, w: 15, h: r.h - 44 }, { fill: '#0B0D12', rx: 3.5, pointerEvents: 'none' })}
                      <Txt o={orient} x={tagRect.x + tagRect.w + 9.5} y={cy} size={8.5} weight={800} land={90} port={0} fill="#FFFFFF" spacing={0.4}>GLASS</Txt>
                    </>
                  )}
                </g>
              )
            })}

            {/* stage-side areas: councillors, worship team, technical space, altar, screen, apostle's chairs, covered walkway, stage reserve */}
            {/* purple walkway connector from door SE3 down through Councillors */}
            <g pointerEvents="none">
              {R({ x: 1274, y: 104, w: 103, h: 40 }, { fill: '#EFE6FF' })}
              {R({ x: 1274, y: 104, w: 22, h: 166 }, { fill: '#EFE6FF' })}
              {/* 10 ft (3 m) spacing marker between Councillors and Worship Team */}
              {(() => {
                const a = P.pt(1214, 240)
                const b = P.pt(1214, 267)
                return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#D97706" strokeWidth={1.8} />
              })()}
              <Txt o={orient} x={1238} y={248} size={9.5} weight={700} fill="#B45309">10 ft</Txt>
              <Txt o={orient} x={1238} y={260} size={9.5} weight={700} fill="#B45309">(3 m)</Txt>
            </g>

            {stageAreas.map((a) => {
              const focus = isFocus(a.ref)
              const c = AREA_COLOR[a.ref] ?? { fill: '#FFFFFF', edge: '#111318', text: '#111318' }
              const r = a.rect
              const cx = r.x + r.w / 2
              const cy = r.y + r.h / 2
              const edge = focus || hover === a.ref ? '#111827' : c.edge
              const thick = focus || hover === a.ref ? 4 : 2.2
              return (
                <g key={a.ref} {...hit(a.ref, a.name)}>
                  {a.ref === 'apostle' && R({ x: r.x - 4, y: r.y - 20, w: 26, h: r.h + 40 }, { fill: 'transparent' })}
                  {a.ref === 'screen' && R({ x: r.x - 4, y: r.y, w: r.w + 8, h: r.h }, { fill: 'transparent' })}

                  {a.ref === 'council' ? (
                    <>
                      {R(r, { fill: c.fill, stroke: edge, strokeWidth: thick, rx: 6 })}
                      <Txt o={orient} x={cx} y={r.y + 12} size={10} weight={800} fill={c.text} spacing={0.3}>COUNCILLORS · 120 (60 + 60)</Txt>
                      {R({ x: r.x + 8, y: r.y + 22, w: 72, h: r.h - 30 }, { fill: '#E0A82E', stroke: '#B87E14', strokeWidth: 1, rx: 2, pointerEvents: 'none' })}
                      {R({ x: r.x + 8, y: r.y + 22, w: 72, h: r.h - 30 }, { fill: 'url(#grm-seats-stage)', pointerEvents: 'none' })}
                      {R({ x: r.x + 82, y: r.y + 20, w: 22, h: r.h - 22 }, { fill: '#EFE6FF', pointerEvents: 'none' })}
                      <Txt o={orient} x={r.x + 93} y={r.y + 22 + (r.h - 30) / 2} size={8} weight={800} land={90} port={0} fill="#6D28D9" spacing={0.5}>WALKWAY</Txt>
                      {R({ x: r.x + 106, y: r.y + 22, w: 71, h: r.h - 30 }, { fill: '#E0A82E', stroke: '#B87E14', strokeWidth: 1, rx: 2, pointerEvents: 'none' })}
                      {R({ x: r.x + 106, y: r.y + 22, w: 71, h: r.h - 30 }, { fill: 'url(#grm-seats-stage)', pointerEvents: 'none' })}
                    </>
                  ) : a.ref === 'worship' ? (
                    <>
                      {R(r, { fill: c.fill, stroke: edge, strokeWidth: thick, rx: 6 })}
                      <Txt o={orient} x={cx} y={r.y + 13} size={10} weight={800} fill={c.text} spacing={0.3}>WORSHIP TEAM · 150 (75 + 75)</Txt>
                      {R({ x: r.x + 18, y: r.y + 24, w: 62, h: r.h - 32 }, { fill: '#22A053', stroke: '#166534', strokeWidth: 1, rx: 2, pointerEvents: 'none' })}
                      {R({ x: r.x + 18, y: r.y + 24, w: 62, h: r.h - 32 }, { fill: 'url(#grm-seats-stage)', pointerEvents: 'none' })}
                      <Txt o={orient} x={r.x + 92} y={r.y + 24 + (r.h - 32) / 2} size={8.5} weight={800} land={90} port={0} fill="#166534" spacing={0.5}>AISLE</Txt>
                      {R({ x: r.x + 104, y: r.y + 24, w: 62, h: r.h - 32 }, { fill: '#22A053', stroke: '#166534', strokeWidth: 1, rx: 2, pointerEvents: 'none' })}
                      {R({ x: r.x + 104, y: r.y + 24, w: 62, h: r.h - 32 }, { fill: 'url(#grm-seats-stage)', pointerEvents: 'none' })}
                    </>
                  ) : a.ref === 'apostle' ? (
                    <Txt o={orient} x={r.x + 9} y={r.y + r.h / 2} size={13} weight={700} land={-90} port={0} fill={c.text}>Apostle and guest ministers</Txt>
                  ) : a.ref === 'protocol' ? (
                    R(r, { fill: 'transparent', stroke: focus || hover === a.ref ? '#111827' : 'none', strokeWidth: 2, rx: 2 })
                  ) : a.ref === 'screen' ? (
                    <>
                      {['#2349B8', '#17A2B8', '#7C3AED', '#17A2B8', '#2349B8'].map((f, i) => (
                        <g key={i}>{R({ x: r.x, y: r.y + (i * r.h) / 5, w: r.w, h: r.h / 5 - 1.5 }, { fill: f, pointerEvents: 'none' })}</g>
                      ))}
                      {R(r, { fill: 'none', stroke: edge, strokeWidth: focus || hover === a.ref ? 3 : 1 })}
                    </>
                  ) : a.ref === 'walkway' ? (
                    <>
                      {R(r, { fill: c.fill, stroke: edge, strokeWidth: thick, rx: 4 })}
                      {(() => {
                        const p = P.pt(r.x + 22, cy)
                        const q = orient === 'landscape'
                          ? `M${p.x - 10} ${p.y}L${p.x + 8} ${p.y - 10}L${p.x + 8} ${p.y + 10}Z`
                          : `M${p.x} ${p.y + 10}L${p.x - 10} ${p.y - 8}L${p.x + 10} ${p.y - 8}Z`
                        return <path d={q} fill="#6D28D9" pointerEvents="none" />
                      })()}
                      <Txt o={orient} x={cx + 12} y={cy} size={11.5} weight={800} fill="#5B21B6" spacing={0.4}>COVERED WALKWAY</Txt>
                    </>
                  ) : (
                    R(r, { fill: c.fill, stroke: edge, strokeWidth: thick, rx: 6 })
                  )}

                  {a.ref === 'altar' && (
                    <>
                      <Txt o={orient} x={cx} y={cy} dy={-44} size={15} weight={500} fill={c.text}>Pulpit and</Txt>
                      <Txt o={orient} x={cx} y={cy} dy={-25} size={15} weight={500} fill={c.text}>platform</Txt>
                      <Txt o={orient} x={cx} y={cy} dy={6} size={30} weight={800} fill={c.text}>ALTAR</Txt>
                      <Txt o={orient} x={cx} y={cy} dy={35} size={13.5} weight={700} fill={c.text}>30 m wide</Txt>
                      <Txt o={orient} x={r.x + 9} y={cy} size={10.5} weight={700} land={90} port={0} fill={c.text}>30 m</Txt>
                    </>
                  )}
                  {a.ref === 'tech' && (
                    <>
                      <Txt o={orient} x={cx} y={cy} dy={-8} size={15} weight={800} fill={c.text}>TECHNICAL</Txt>
                      <Txt o={orient} x={cx} y={cy} dy={10} size={12} weight={500} fill="#4B5263">space</Txt>
                    </>
                  )}
                </g>
              )
            })}
            <Txt o={orient} x={1412} y={640} size={10} weight={800} fill="#1F2430">SCREEN</Txt>
            <Txt o={orient} x={1412} y={653} size={8.5} weight={500} fill="#4B5263">1 m deep</Txt>

            {/* usher seats: 4 per section on ALL sections 1–72 (including 5, 6, 7, 17, 18) */}
            {spots.map((sp) => {
              const p = P.pt(sp.x, sp.y)
              const who = sp.positionId ? occupants?.[sp.positionId] : undefined
              const away = !who && sp.positionId ? uncovered?.[sp.positionId] : undefined
              const mine = !!sp.positionId && sp.positionId === highlightPositionId
              const targetPosId = sp.positionId ?? sp.fallbackPositionId
              const tappable = !!(onSelectSpot && sp.zoneId && targetPosId) || !!(onSelect && sp.zoneId)
              const hov = hoverSpot === sp.key
              const handleSpotActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
                e.stopPropagation()
                if (moved.current) return
                if (onSelectSpot && sp.zoneId && targetPosId) onSelectSpot(sp.zoneId, targetPosId)
                else if (onSelect && sp.zoneId) onSelect(sp.zoneId)
              }
              return (
                <g
                  key={sp.key}
                  {...(tappable ? {
                    role: 'button',
                    tabIndex: 0,
                    'aria-label': `${sp.zoneName}, ${sp.name}: ${who ?? (away ? `open, ${away} can't make it` : 'usher seat')}`,
                    onClick: handleSpotActivate,
                    onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleSpotActivate(e)),
                    className: 'cursor-pointer outline-none',
                  } : {})}
                  onMouseEnter={() => setHoverSpot(sp.key)}
                  onMouseLeave={() => setHoverSpot((h) => (h === sp.key ? null : h))}
                >
                  {tappable && <circle cx={p.x} cy={p.y} r={13} fill="transparent" />}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={mine ? 9.5 : 6.2}
                    fill={mine ? '#93304E' : '#F59E0B'}
                    stroke={hov ? '#111827' : mine ? '#FFFFFF' : away ? '#D8263A' : '#4A3508'}
                    strokeWidth={hov ? 2.8 : mine ? 2.5 : away ? 2.4 : 1.6}
                  />
                </g>
              )
            })}

            {/* doors */}
            {DOORS.map((d) => (
              <DoorMark
                key={d.ref}
                d={d}
                P={P}
                o={orient}
                focus={isFocus(d.ref)}
                hover={hover === d.ref}
                hit={hit(d.ref, `Door ${d.ref}, ${DOOR_KIND_LABEL[d.kind].toLowerCase()}`)}
              />
            ))}
            <g pointerEvents="none">
              {DOORS.filter((d) => d.kind === 'closed').map((d) => ['CLOSED', 'DURING', 'SERVICE'].map((t, i) => (
                <Txt key={d.ref + t} o={orient} x={d.label.x} y={d.label.y} dy={orient === 'landscape' ? 24 + i * 11 : 0} size={9.5} weight={800} fill="#E8711A" land={0} port={0}>{orient === 'landscape' ? t : ''}</Txt>
              )))}
              {orient === 'portrait' && DOORS.filter((d) => d.kind === 'closed').map((d) => (
                <Txt key={d.ref + 'p'} o={orient} x={d.label.x} y={d.label.y} dy={22} size={9.5} weight={800} fill="#E8711A">CLOSED</Txt>
              ))}
              {DOORS.filter((d) => d.kind === 'twoway').map((d) => {
                const p = P.pt(d.label.x + 36, d.label.y)
                const v = orient === 'landscape'
                return (
                  <g key={d.ref}>
                    <Txt o={orient} x={d.label.x} y={46} size={10} weight={800} fill="#D8263A" port={-90}>ENTRANCE / EXIT</Txt>
                    <path d={v ? `M${p.x} ${p.y - 12}V${p.y + 12}M${p.x - 4.5} ${p.y - 6.5}L${p.x} ${p.y - 12}L${p.x + 4.5} ${p.y - 6.5}M${p.x - 4.5} ${p.y + 6.5}L${p.x} ${p.y + 12}L${p.x + 4.5} ${p.y + 6.5}` : `M${p.x - 12} ${p.y}H${p.x + 12}M${p.x - 6.5} ${p.y - 4.5}L${p.x - 12} ${p.y}L${p.x - 6.5} ${p.y + 4.5}M${p.x + 6.5} ${p.y - 4.5}L${p.x + 12} ${p.y}L${p.x + 6.5} ${p.y + 4.5}`} stroke="#D8263A" strokeWidth={2} fill="none" />
                  </g>
                )
              })}
              {DOORS.filter((d) => d.kind === 'workers').map((d) => (
                <Txt key={d.ref} o={orient} x={d.label.x} y={1252} size={9.5} weight={800} fill="#0F6B58" port={-90}>WORKERS ONLY</Txt>
              ))}
              {(() => {
                const p = DOORS.find((d) => d.ref === 'SE2')
                if (!p) return null
                return (
                  <>
                    <Txt o={orient} x={p.label.x} y={p.label.y} dy={24} size={10} weight={500} fill="#4B5263">to</Txt>
                    <Txt o={orient} x={p.label.x} y={p.label.y} dy={36} size={10} weight={500} fill="#4B5263">Rotunda</Txt>
                  </>
                )
              })()}
            </g>

            {/* nave labels */}
            {NAVES.map((n) => {
              const a = P.pt(1478, n.y0 + 6)
              const b = P.pt(1478, n.y1 - 6)
              const t0 = P.pt(1470, n.y0)
              const t1 = P.pt(1486, n.y0)
              return (
                <g key={n.name} pointerEvents="none">
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#C4C9D4" strokeWidth={1.5} />
                  <line x1={t0.x} y1={t0.y} x2={t1.x} y2={t1.y} stroke="#9AA3B5" strokeWidth={1.5} />
                  <rect {...(() => { const c = P.pt(1478, (n.y0 + n.y1) / 2); return orient === 'landscape' ? { x: c.x - 11, y: c.y - 62, width: 22, height: 124 } : { x: c.x - 62, y: c.y - 11, width: 124, height: 22 } })()} fill="#F4F6FA" />
                  <Txt o={orient} x={1478} y={(n.y0 + n.y1) / 2} size={12.5} weight={700} fill="#6B7280" land={90} port={0} spacing={1}>{`${n.name} · ${n.size}`}</Txt>
                </g>
              )
            })}

            {/* you-are-here pin */}
            {mode === 'locate' && highlightRef && (() => {
              const r = refRect(highlightRef)!
              const s = P.rect(r)
              const at = mySpot ? P.pt(mySpot.x, mySpot.y) : { x: s.x + s.w / 2, y: s.y + s.h / 2 }
              const cx = at.x
              const cy = at.y
              const fs = 34
              const pillW = pinLabel.length * fs * 0.56 + 44
              const pillH = 58
              const above = cy - 80 - pillH > vb.y
              const py = above ? cy - 36 - pillH : cy + 36
              const px = Math.min(vb.x + vb.w - pillW / 2 - 10, Math.max(vb.x + pillW / 2 + 10, cx))
              return (
                <g pointerEvents="none">
                  <circle cx={cx} cy={cy} r="26" fill="#93304E" opacity=".35" className="animate-pulseRing" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
                  <circle cx={cx} cy={cy} r="15" fill="#FFFFFF" stroke="#93304E" strokeWidth="7" />
                  <motion.g initial={{ opacity: 0, y: above ? -10 : 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.35 }}>
                    <rect x={px - pillW / 2} y={py} width={pillW} height={pillH} rx={pillH / 2} fill="#0B1120" />
                    <path d={above ? `M${cx - 11} ${py + pillH - 1}L${cx} ${py + pillH + 13}L${cx + 11} ${py + pillH - 1}Z` : `M${cx - 11} ${py + 1}L${cx} ${py - 13}L${cx + 11} ${py + 1}Z`} fill="#0B1120" />
                    <text x={px} y={py + pillH / 2} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight={700} fill="#FFFFFF">{pinLabel}</text>
                  </motion.g>
                </g>
              )
            })()}
          </svg>
        </div>

      </div>

      {/* what's under the finger / selected */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-[2.5rem] min-w-0 text-sm" aria-live="polite">
          {mode === 'locate' && highlightRef ? (
            <p className="text-ink-600">
              {mySpot && <>Your seat is the <span className="font-semibold text-wine-600">{mySpot.name.toLowerCase()}</span> of {mySpot.zoneName}, facing the altar. </>}
              {entrance ? <>The nearest door is <span className="font-semibold text-ok-600">{entrance.ref}</span>. </> : null}
              {highlightZoneId && info[highlightZoneId]?.leaders?.length ? (
                <>Section leader{info[highlightZoneId].leaders!.length > 1 ? 's' : ''}: <span className="font-semibold text-ink-900">{info[highlightZoneId].leaders!.join(', ')}</span>. </>
              ) : null}
              {highlightZoneId && info[highlightZoneId]?.coordinators?.length ? (
                <>Coordinator{info[highlightZoneId].coordinators!.length > 1 ? 's' : ''}: <span className="font-semibold text-ink-900">{info[highlightZoneId].coordinators!.join(', ')}</span>. </>
              ) : null}
              {orient === 'portrait' ? 'The altar is at the top of the plan.' : 'The altar is on the right of the plan.'}
            </p>
          ) : hoveredSpot ? (
            <>
              <p className="break-words font-semibold leading-snug text-ink-900">{hoveredSpot.zoneName}<span className="font-normal text-ink-500"> · {hoveredSpot.name}</span></p>
              <p className="break-words leading-relaxed text-ink-500">
                {(hoveredSpot.positionId && occupants?.[hoveredSpot.positionId]) ?? (hoveredSpot.positionId && uncovered?.[hoveredSpot.positionId] ? `Open: ${uncovered[hoveredSpot.positionId]} can't make it` : 'Usher seat')}
                {hoveredSpot.zoneId && info[hoveredSpot.zoneId]?.leaders?.length ? ` · Leader: ${info[hoveredSpot.zoneId].leaders!.join(', ')}` : ''}
                {onSelectSpot ? ' · tap to assign' : ''}
              </p>
            </>
          ) : activeZone ? (
            <>
              <p className="break-words font-semibold leading-snug text-ink-900">{activeZone.name}{zoneNote(activeZone) && <span className="font-normal text-ink-500"> · {zoneNote(activeZone)}</span>}</p>
              {info[activeZone.id] && (
                <p className="break-words leading-relaxed text-ink-500 tabular">
                  {info[activeZone.id].assigned != null ? (
                    <>
                      {info[activeZone.id].assigned ?? 0}{info[activeZone.id].required ? ` of ${info[activeZone.id].required}` : ''} ushers
                      {info[activeZone.id].coverage != null && ` · ${info[activeZone.id].coverage}% staffed`}
                    </>
                  ) : null}
                  {info[activeZone.id].leaders?.length ? `${info[activeZone.id].assigned != null ? ' · ' : ''}Leader${info[activeZone.id].leaders!.length > 1 ? 's' : ''}: ${info[activeZone.id].leaders!.join(', ')}` : ''}
                  {info[activeZone.id].coordinators?.length ? ` · Coord: ${info[activeZone.id].coordinators!.join(', ')}` : ''}
                </p>
              )}
            </>
          ) : (
            <p className="text-ink-500">{interactive ? `Tap a section, aisle or door${onSelectSpot ? ', or zoom in and tap an usher seat' : ''}. Pinch or double-tap to zoom.` : 'Pinch or double-tap to zoom.'}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* controls */}
          {(!compact || highlightRef || view.k > 1) && (
          <div className="flex shrink-0 overflow-hidden rounded-xl border border-line bg-white shadow-soft">
            {!compact && <MapBtn label="Zoom in" onClick={() => zoomAt(view.k * 1.6, (box.current?.clientWidth ?? 0) / 2, (box.current?.clientHeight ?? 0) / 2)} disabled={view.k >= MAX_K}><Plus className="h-4 w-4" /></MapBtn>}
            {!compact && <MapBtn label="Zoom out" onClick={() => zoomAt(view.k / 1.6, (box.current?.clientWidth ?? 0) / 2, (box.current?.clientHeight ?? 0) / 2)} disabled={view.k <= 1}><Minus className="h-4 w-4" /></MapBtn>}
            {highlightRef && <MapBtn label="Zoom to my seat" onClick={() => (mySpot ? zoomToPoint(mySpot.x, mySpot.y, 3.4) : zoomToRef(highlightRef, 2.8))}><Crosshair className="h-4 w-4" /></MapBtn>}
            {view.k > 1 && <MapBtn label="Show whole hall" onClick={() => setView({ k: 1, x: 0, y: 0 })}><Maximize2 className="h-4 w-4" /></MapBtn>}
            {!compact && <MapBtn label="Turn the plan" onClick={() => setManualOrient(orient === 'portrait' ? 'landscape' : 'portrait')}><RotateCw className="h-4 w-4" /></MapBtn>}
          </div>
          )}
        {interactive && !compact && (
          <div className="flex shrink-0 items-center gap-2">
            <label className="relative">
              <span className="sr-only">Find a section, aisle or door</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
              <input
                value={find}
                onChange={(e) => setFind(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && goFind()}
                placeholder="Section 14, Sierra, C4"
                className="field h-10 w-44 pl-8 text-sm"
                enterKeyHint="go"
              />
            </label>
            <button onClick={goFind} className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink-700 hover:border-line-strong">Find</button>
          </div>
        )}
      </div>
      </div>

      {!compact && !hideLegend && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
          {[
            ['#2F5DD3', 'Seating sections, 11 rows (12 seats per row); named front sections: 5 rows'],
            ['#34A853', 'MPFs & Leaders (front row of BRAVO); Int’l Guests (BRAVO, ALPHA; sections 8–10, 20–22)'],
            ['#17A2B8', 'ADCs & PAs (front row of DELTA)'],
            ['#3A3D44', 'Select Contemporaries (CHARLIE)'],
            ['#E5486F', 'Lady Sandra’s section (ECHO)'],
            ['#7C3AED', 'Apostle and guest ministers (9 special chairs)'],
            ['#E89B3C', 'Media and technical (by 18–19, 30–31; media by 42–43, 54–55)'],
            ['#111318', 'Technical space (stage, beside the altar)'],
            ['#FDECC8', 'Altar and pulpit platform (30 m, Nave B)'],
            ['#2BA457', 'Worship team (150 chairs: 75 + 75)'],
            ['#17A2B8', 'Crane and screen: 1 m strip behind the stage'],
            ['#2E9E5B', 'Aisle doors C1–C9, one on each aisle (back wall)'],
            ['#F28C1B', 'Aisle doors C2, C5, C8: closed during service'],
            ['#0F6B58', 'Workers only doors X1, X2 (entrance and exit, Nave A)'],
            ['#D8263A', 'Two-way doors P11, P12, P13 (Nave C): entrance and exit'],
            ['#7C3AED', 'Access doors SE2, SE3, SE4, P10 & covered walkway'],
            ['#C69214', 'Councillors (120 chairs: 60 + 60), behind the worship team, 10 ft apart'],
            ['#C5D3F0', 'Aisles 1–9, cross aisles and front aisle'],
            ['#A9BDEB', 'Nave B aisles 4 to 6 (central lane)'],
          ].map(([c, l]) => (
            <span key={l} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-black/10" style={{ background: c }} />{l}</span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3.5 shrink-0 rounded-sm border border-dashed border-[#F08A1C]" />Outer sections by the exit doors (dashed outline)</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 shrink-0 border-t-2 border-dashed border-ink-700" />Tent line, chair column removed: aluminium pillars (not an aisle)</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#4A3508] bg-[#F59E0B]" />Usher seats: 4 per section (first and last row, both ends), sections 1–72 only</span>
        </div>
      )}

      {unplaced.length > 0 && !compact && mode !== 'locate' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <span>Outside the hall:</span>
          {unplaced.map((z) => (
            <button key={z.id} onClick={() => onSelect?.(z.id)} className={cn('min-h-[32px] rounded-full border border-line bg-white px-3 py-1 text-ink-700 hover:border-line-strong', z.id === focusId && 'border-wine-400 text-wine-700')}>
              {z.name}
              {mode === 'coverage' && info[z.id] && <span className="ml-1.5 text-ink-400 tabular">{info[z.id].coverage}%</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Text that stays upright; `land`/`port` give its rotation in each orientation. */
function Txt({ o, x, y, dy = 0, children, size = 20, weight = 700, fill = '#0F1B33', land = 0, port = 0, spacing, anchor = 'middle' }: { o: Orient; x: number; y: number; dy?: number; children: React.ReactNode; size?: number; weight?: number; fill?: string; land?: number; port?: number; spacing?: number; anchor?: 'middle' | 'start' }) {
  const q = project(o).pt(x, y)
  const p = { x: q.x, y: q.y + dy }
  const rot = o === 'landscape' ? land : port
  return (
    <text x={p.x} y={p.y} transform={rot ? `rotate(${rot} ${p.x} ${p.y})` : undefined} textAnchor={anchor} dominantBaseline="central" fontSize={size} fontWeight={weight} fill={fill} letterSpacing={spacing} pointerEvents="none">
      {children}
    </text>
  )
}

function MapBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} disabled={disabled} className="grid h-10 w-10 place-items-center border-r border-line text-ink-600 last:border-r-0 hover:bg-paper disabled:opacity-35">
      {children}
    </button>
  )
}


function DoorMark({ d, P, o, focus, hover, hit }: {
  d: Door
  P: ReturnType<typeof project>
  o: Orient
  focus: boolean
  hover: boolean
  hit: Record<string, unknown>
}) {
  const B = PLAN.building
  const color = DOOR_COLOR[d.kind]
  const half = (d.b - d.a) / 2
  const wall = (t: number) => {
    if (d.side === 'top') return { x: t, y: B.y }
    if (d.side === 'bottom') return { x: t, y: B.y + B.h }
    if (d.side === 'left') return { x: B.x, y: t }
    return { x: B.x + B.w, y: t }
  }
  // door leaves swing outward, as drawn on the plan
  const n = d.side === 'top' ? { x: 0, y: -1 } : d.side === 'bottom' ? { x: 0, y: 1 } : d.side === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 }
  const a = wall(d.a)
  const b = wall(d.b)
  const m = wall(d.a + half)
  const leaf = (h: { x: number; y: number }) => P.pt(h.x + n.x * half, h.y + n.y * half)
  const pa = P.pt(a.x, a.y)
  const pb = P.pt(b.x, b.y)
  const pm = P.pt(m.x, m.y)
  const la = leaf(a)
  const lb = leaf(b)
  const sweepA = d.side === 'top' || d.side === 'right' ? 1 : 0
  const sweepB = 1 - sweepA
  const swing = `M${pa.x} ${pa.y}L${la.x} ${la.y}A${half} ${half} 0 0 ${sweepA} ${pm.x} ${pm.y}M${pb.x} ${pb.y}L${lb.x} ${lb.y}A${half} ${half} 0 0 ${sweepB} ${pm.x} ${pm.y}`
  const lp = P.pt(d.label.x, d.label.y)
  const r = P.rect(doorRect(d))
  const bw = 48
  const bh = 28
  return (
    <g {...hit}>
      <rect x={Math.min(r.x, lp.x - bw / 2) - 6} y={Math.min(r.y, lp.y - bh / 2) - 6} width={Math.max(r.x + r.w, lp.x + bw / 2) - Math.min(r.x, lp.x - bw / 2) + 12} height={Math.max(r.y + r.h, lp.y + bh / 2) - Math.min(r.y, lp.y - bh / 2) + 12} fill="transparent" />
      <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#FFFFFF" strokeWidth={8} />
      <path d={swing} fill={`${color}22`} stroke={color} strokeWidth={2} />
      <rect x={lp.x - bw / 2} y={lp.y - bh / 2} width={bw} height={bh} rx={bh / 2} fill={color} stroke={focus || hover ? '#111827' : '#FFFFFF'} strokeWidth={focus || hover ? 3.5 : 2} />
      <Txt o={o} x={d.label.x} y={d.label.y} size={15} weight={800} fill="#FFFFFF">{d.ref}</Txt>
    </g>
  )
}
