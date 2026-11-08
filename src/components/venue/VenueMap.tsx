import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Crosshair, Maximize2, Minus, Plus, RotateCw, Search } from 'lucide-react'
import type { Position, Zone } from '@/data/types'
import {
  AREAS, DOORS, DOOR_KIND_LABEL, LANE_AISLES, NAVES, PILLAR_X, PLAN, TENT_ROWS, AISLE_COUNT, SECTION_COUNT,
  aisleCenterY, aisleLabelCols, aisleRects, colCenterX, doorRect, hasSpots, isOuterSection, nearestEntrance, refRect, sectionOfRef, sectionRect, sectionStyle,
  spotPoint, tentLineY, zoneNote, zoneRef,
  type Door, type Rect,
} from '@/data/venue'
import { cn } from '@/lib/utils'

/**
 * The arena floor plan as a tappable schematic: 83 seating sections,
 * aisles 1–9, the tent lines, the doors and the altar-side areas, drawn from
 * the real plan, plus the four usher seats in each section. The spots are
 * filled in from the roster: each spot is a position, and whoever is assigned
 * to it stands there.
 *
 * On wide screens it is drawn as on paper, altar to the right. On narrow
 * screens it turns so the altar is at the top, which fits a phone and matches
 * the view of someone standing at the back facing the altar. Pinch, drag,
 * double-tap or the buttons zoom and pan it.
 */

export type MapMode = 'locate' | 'coverage' | 'plain'

export interface ZoneInfo {
  assigned?: number
  required?: number
  coverage?: number
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

/* ---------- colours ---------- */

const PLAIN: Record<ReturnType<typeof sectionStyle>, { fill: string; edge: string }> = {
  standard: { fill: '#2F5DD3', edge: '#1E3F9E' },
  protocol: { fill: '#2F5DD3', edge: '#1E3F9E' },
  international: { fill: '#34A853', edge: '#1E7A39' },
  lady: { fill: '#E5486F', edge: '#B3204A' },
  ministers: { fill: '#3A3D44', edge: '#15171B' },
  technical: { fill: '#FFFFFF', edge: '#15171B' },
  media: { fill: '#FFF3E2', edge: '#F08A1C' },
}
const DOOR_COLOR: Record<Door['kind'], string> = { aisle: '#2E9E5B', closed: '#F28C1B', twoway: '#D8263A', workers: '#0F6B58', access: '#7C3AED' }
const AREA_COLOR: Record<string, { fill: string; edge: string; text: string }> = {
  worship: { fill: '#E3F6EA', edge: '#2BA457', text: '#1F7A3E' },
  altar: { fill: '#FFF4C2', edge: '#F0961C', text: '#7A3E06' },
  tech: { fill: '#FFFFFF', edge: '#111318', text: '#111318' },
  reserve: { fill: '#E8E4FB', edge: '#9A8CE8', text: '#4B4FB0' },
  apostle: { fill: '#F2A33A', edge: '#7C3AED', text: '#6D28D9' },
  protocol: { fill: '#DFF4F7', edge: '#17A2B8', text: '#0E7490' },
  screen: { fill: '#17A2B8', edge: '#0F1B33', text: '#0F1B33' },
  walkway: { fill: '#EFE6FF', edge: '#7C3AED', text: '#5B21B6' },
}

function tone(c = 0) {
  if (c >= 95) return { fill: '#A8D8BC', solid: '#2F7D57', edge: '#2F7D57', label: 'Fully staffed' }
  if (c >= 85) return { fill: '#F0DCA6', solid: '#C59E4F', edge: '#A9822F', label: 'Nearly staffed' }
  return { fill: '#EDB8C7', solid: '#93304E', edge: '#93304E', label: 'Needs ushers' }
}
const NO_ZONE = { fill: '#ECE8E1', edge: '#D6CFC3' }

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

export function VenueMap({ zones, mode = 'plain', highlightZoneId, selectedZoneId, info = {}, onSelect, className, compact, pinLabel = 'You', positions, occupants, highlightPositionId, onSelectSpot, uncovered }: Props) {
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

  /** usher spots: section positions that stand at a corner of their section */
  const spots = useMemo(() => {
    const out: { positionId: string; zoneId: string; zoneName: string; name: string; x: number; y: number }[] = []
    for (const p of positions ?? []) {
      if (!p.spot) continue
      const ref = refOf.get(p.zoneId)
      const n = sectionOfRef(ref)
      if (!n || !hasSpots(n)) continue
      out.push({ positionId: p.id, zoneId: p.zoneId, zoneName: byRef.get(ref!)!.name, name: p.name, ...spotPoint(n, p.spot) })
    }
    return out
  }, [positions, refOf, byRef])
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
    const q = find.trim().toUpperCase().replace(/^SECTION\s*/, '').replace(/^AISLE\s*/, 'A')
    let ref: string | undefined
    if (/^\d{1,2}$/.test(q) && +q >= 1 && +q <= SECTION_COUNT) ref = `S${+q}`
    else if (/^A[1-9]$/.test(q)) ref = q
    else if (DOORS.some((d) => d.ref === q)) ref = q
    if (!ref) return
    zoomToRef(ref)
    const z = byRef.get(ref)
    if (z) onSelect?.(z.id)
    setFind('')
  }

  /* --- look of each plan item --- */
  const zoneFor = (ref: string) => byRef.get(ref)
  const isFocus = (ref: string) => !!focusId && refOf.get(focusId) === ref
  const dim = (ref: string) => mode === 'locate' && !isFocus(ref)
  const coverageOf = (ref: string) => {
    const z = zoneFor(ref)
    return z ? info[z.id]?.coverage ?? 0 : undefined
  }
  const sectionColors = (n: number) => {
    const ref = `S${n}`
    if (mode === 'locate' && isFocus(ref)) return { fill: '#93304E', edge: '#5E1A30' }
    if (mode === 'coverage' && !zoneFor(ref)) return NO_ZONE
    return PLAIN[sectionStyle(n)]
  }

  const hit = (ref: string, label: string) => {
    const z = zoneFor(ref)
    if (!z || !interactive) return { onMouseEnter: () => z && setHover(ref), onMouseLeave: () => setHover((h) => (h === ref ? null : h)) }
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

  const hoveredSpot = hoverSpot ? spots.find((s) => s.positionId === hoverSpot) : undefined
  const activeRef = hover ?? (focusId ? refOf.get(focusId) : undefined)
  const activeZone = activeRef ? zoneFor(activeRef) : undefined
  const highlightRef = highlightZoneId ? refOf.get(highlightZoneId) : undefined
  const entrance = mode === 'locate' && highlightRef && !DOORS.some((d) => d.ref === highlightRef) ? nearestEntrance(highlightRef, mySpot) : undefined

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
            aria-label="Arena floor plan: 83 seating sections with usher seats, aisles 1 to 9, doors and the altar"
            style={{ fontFamily: 'Manrope, ui-sans-serif, system-ui, sans-serif' }}
          >
            <defs>
              <pattern id="grm-seats" width="11" height="6.8" patternUnits="userSpaceOnUse" patternTransform={orient === 'portrait' ? 'rotate(90)' : undefined}>
                <path d="M10.5 0V6.8M0 6.3H11" stroke="#FFFFFF" strokeOpacity=".55" strokeWidth="1" />
              </pattern>
            </defs>

            {/* overall dimensions */}
            <g pointerEvents="none">
              {(() => {
                const B = PLAN.building
                const a = P.pt(B.x, 35), b = P.pt(B.x + B.w, 35)
                const c = P.pt(14, B.y), d = P.pt(14, B.y + B.h)
                const tick = (x: number, y: number, vertical: boolean) => {
                  const q = vertical ? P.pt(x, y - 7) : P.pt(x - 7, y)
                  const r = vertical ? P.pt(x, y + 7) : P.pt(x + 7, y)
                  return <line key={`${x}-${y}`} x1={q.x} y1={q.y} x2={r.x} y2={r.y} stroke="#6B7280" strokeWidth={2} />
                }
                return (
                  <>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#9AA3B5" strokeWidth={1.5} />
                    {tick(B.x, 35, true)}{tick(B.x + B.w, 35, true)}
                    <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} stroke="#9AA3B5" strokeWidth={1.5} />
                    {tick(14, B.y, false)}{tick(14, B.y + B.h, false)}
                  </>
                )
              })()}
              {(() => { const p = P.pt(B_MID_X, 35); return <rect x={p.x - 34} y={p.y - 11} width={68} height={22} fill="#F4F6FA" transform={orient === 'portrait' ? `rotate(-90 ${p.x} ${p.y})` : undefined} /> })()}
              <Txt o={orient} x={B_MID_X} y={35} size={15} weight={600} fill="#374151" port={-90}>105 m</Txt>
              {(() => { const p = P.pt(14, B_MID_Y); return <rect x={p.x - 11} y={p.y - 26} width={22} height={52} fill="#F4F6FA" transform={orient === 'portrait' ? `rotate(-90 ${p.x} ${p.y})` : undefined} /> })()}
              <Txt o={orient} x={14} y={B_MID_Y} size={15} weight={600} fill="#374151" land={-90}>90 m</Txt>
            </g>

            {/* building */}
            {R(PLAN.building, { fill: '#FFFFFF', stroke: '#111318', strokeWidth: 6 })}
            {R(PLAN.seating, { fill: '#E3E8F2', rx: 10 })}

            {/* aisles */}
            {Array.from({ length: AISLE_COUNT }, (_, i) => i + 1).map((n) => {
              const ref = `A${n}`
              const rects = aisleRects(n)
              const z = zoneFor(ref)
              const focus = isFocus(ref)
              const lane = LANE_AISLES.includes(n)
              const c = mode === 'coverage' && z ? tone(coverageOf(ref)).solid : undefined
              const fill = focus && mode === 'locate' ? '#93304E' : lane ? '#A9BDEB' : '#C5D3F0'
              const cy = aisleCenterY(n)
              const txt = focus && mode === 'locate' ? '#FFFFFF' : '#2B4AA6'
              return (
                <g key={ref} {...hit(ref, `Aisle ${n}`)} opacity={dim(ref) ? 0.5 : 1}>
                  {rects.map((r, i) => (
                    <g key={i}>
                      {R({ x: r.x, y: r.y - 4, w: r.w, h: r.h + 8 }, { fill: 'transparent' })}
                      {R({ x: r.x, y: r.y + 1, w: r.w, h: r.h - 2 }, { fill, stroke: focus || hover === ref ? '#111827' : 'none', strokeWidth: 3 })}
                    </g>
                  ))}
                  {aisleLabelCols(n).map((col) => (
                    <Txt o={orient} key={col} x={colCenterX(col)} y={cy} size={12} fill={txt} land={0} port={-90} spacing={0.5}>AISLE {n}</Txt>
                  ))}
                  {rects[1] && <Txt o={orient} x={rects[1].x + rects[1].w / 2 - 6} y={rects[1].y + rects[1].h / 2} size={12} fill={txt} land={0} port={-90} spacing={0.5}>AISLE {n}</Txt>}
                  {(() => {
                    const p = P.pt(153, cy)
                    return (
                      <g>
                        <circle cx={p.x} cy={p.y} r={22} fill="transparent" />
                        <circle cx={p.x} cy={p.y} r={12} fill={focus && mode === 'locate' ? '#93304E' : c ?? '#0B0D12'} stroke="#FFFFFF" strokeWidth={2.5} />
                      </g>
                    )
                  })()}
                  <Txt o={orient} x={153} y={cy} size={13} weight={800} fill="#FFFFFF">{n}</Txt>
                </g>
              )
            })}

            {/* tent lines: a chair column removed for the aluminium pillars, not an aisle */}
            {TENT_ROWS.map((row) => {
              const y = tentLineY(row)
              const a = P.pt(PILLAR_X[0], y)
              const b = P.pt(PILLAR_X[PILLAR_X.length - 1], y)
              return (
                <g key={row} pointerEvents="none" opacity={mode === 'locate' ? 0.6 : 1}>
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

            {/* sections */}
            {Array.from({ length: SECTION_COUNT }, (_, i) => i + 1).map((n) => {
              const ref = `S${n}`
              const r = sectionRect(n)
              const style = sectionStyle(n)
              const col = sectionColors(n)
              const focus = isFocus(ref)
              const lit = mode === 'locate' && focus
              const edgeOn = focus || hover === ref
              const badge = mode === 'coverage' && zoneFor(ref) ? tone(coverageOf(ref)).solid : '#0B0D12'
              const cx = r.x + r.w / 2
              const cy = r.y + r.h / 2
              const pill = style === 'lady' || style === 'ministers'
              const block = style === 'technical' || style === 'media'
              const numX = pill || style === 'protocol' ? cx - 8 : cx
              return (
                <g key={ref} {...hit(ref, `Section ${n}`)} opacity={dim(ref) ? 0.42 : 1}>
                  {isOuterSection(n) && R({ x: r.x - 3, y: r.y - 4, w: r.w + 6, h: r.h + 8 }, { fill: 'none', stroke: '#F08A1C', strokeWidth: 1.6, strokeDasharray: '5 4', pointerEvents: 'none' })}
                  {R(r, { fill: col.fill, stroke: edgeOn ? '#111827' : col.edge, strokeWidth: edgeOn ? 4 : 1.5, rx: block ? 4 : 2 })}
                  {!block && R({ x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 }, { fill: 'url(#grm-seats)', pointerEvents: 'none', opacity: lit ? 0.5 : 1 })}
                  {block ? (
                    <>
                      <Txt o={orient} x={cx} y={cy} size={style === 'technical' ? 17 : 18} weight={800} land={-90} port={0} fill={lit ? '#FFFFFF' : style === 'technical' ? '#111318' : '#E8711A'} spacing={0.5}>
                        {style === 'technical' ? 'TECHNICAL' : 'MEDIA'}
                      </Txt>
                      {style === 'media' && <Txt o={orient} x={cx + 17} y={cy} size={10} weight={500} land={-90} port={0} fill={lit ? '#FFFFFF' : '#4B5263'}>videography</Txt>}
                    </>
                  ) : (
                    <>
                      {pill && !lit && R({ x: r.x + r.w - 24, y: r.y + 8, w: 17, h: r.h - 16 }, { fill: '#FFFFFF', stroke: col.edge, strokeWidth: 1.5, rx: 8, pointerEvents: 'none' })}
                      {pill && !lit && (
                        <Txt o={orient} x={r.x + r.w - 15.5} y={cy} size={style === 'lady' ? 10 : 11} land={-90} port={0} fill={style === 'lady' ? '#B3204A' : '#111318'}>
                          {style === 'lady' ? 'Lady Sandra’s' : 'Ministers'}
                        </Txt>
                      )}
                      {(() => {
                        const p = P.pt(numX, cy)
                        return <circle cx={p.x} cy={p.y} r={17} fill={lit ? '#FFFFFF' : badge} stroke="#FFFFFF" strokeWidth={lit ? 0 : 1.5} pointerEvents="none" />
                      })()}
                      <Txt o={orient} x={numX} y={cy} size={17} weight={800} fill={lit ? '#93304E' : '#FFFFFF'}>{n}</Txt>
                    </>
                  )}
                </g>
              )
            })}
            <Txt o={orient} x={960} y={753} size={10} weight={500} fill="#4B5263">Sections 17 and 18</Txt>

            {/* areas beside the altar */}
            {AREAS.map((a) => {
              const z = zoneFor(a.ref)
              const focus = isFocus(a.ref)
              const c = AREA_COLOR[a.ref]
              const lit = focus && mode === 'locate'
              const cov = mode === 'coverage' && z ? tone(coverageOf(a.ref)) : undefined
              const fill = lit ? '#93304E' : c.fill
              const r = a.rect
              const cx = r.x + r.w / 2
              const cy = r.y + r.h / 2
              const txt = lit ? '#FFFFFF' : c.text
              const edge = focus || hover === a.ref ? '#111827' : c.edge
              const thick = focus || hover === a.ref ? 4 : 2.5
              return (
                <g key={a.ref} {...hit(a.ref, a.name)} opacity={dim(a.ref) ? 0.5 : 1}>
                  {a.ref === 'apostle' && R({ x: r.x - 2, y: r.y - 60, w: 52, h: r.h + 120 }, { fill: 'transparent' })}
                  {a.ref === 'screen' && R({ x: r.x - 4, y: r.y, w: r.w + 8, h: r.h }, { fill: 'transparent' })}
                  {a.ref === 'apostle' ? (
                    <>
                      {R(r, { fill: '#FFFFFF', stroke: edge, strokeWidth: focus || hover === a.ref ? 3 : 1.5, rx: 3 })}
                      {Array.from({ length: 9 }, (_, i) => <g key={i}>{R({ x: r.x + 3, y: r.y + 3 + i * 10.4, w: r.w - 6, h: 8 }, { fill: lit ? '#93304E' : '#F2A33A', stroke: '#B86A12', strokeWidth: 1, rx: 2, pointerEvents: 'none' })}</g>)}
                      <Txt o={orient} x={1217} y={677} size={15} weight={700} land={-90} port={0} fill={c.text}>Apostle and guest ministers</Txt>
                    </>
                  ) : a.ref === 'screen' ? (
                    <>
                      {['#2349B8', '#17A2B8', '#7C3AED', '#17A2B8', '#2349B8'].map((f, i) => <g key={i}>{R({ x: r.x, y: r.y + (i * r.h) / 5, w: r.w, h: r.h / 5 - 1.5 }, { fill: lit ? '#93304E' : f, pointerEvents: 'none' })}</g>)}
                      {R(r, { fill: 'none', stroke: edge, strokeWidth: focus || hover === a.ref ? 3 : 1 })}
                    </>
                  ) : a.ref === 'walkway' ? (
                    <>
                      {R(r, { fill: lit ? '#93304E' : c.fill, stroke: edge, strokeWidth: thick })}
                      {(() => {
                        const p = P.pt(r.x + 20, cy)
                        const q = orient === 'landscape'
                          ? `M${p.x - 10} ${p.y}L${p.x + 8} ${p.y - 11}L${p.x + 8} ${p.y + 11}Z`
                          : `M${p.x} ${p.y + 10}L${p.x - 11} ${p.y - 8}L${p.x + 11} ${p.y - 8}Z`
                        return <path d={q} fill={lit ? '#FFFFFF' : '#6D28D9'} pointerEvents="none" />
                      })()}
                      <Txt o={orient} x={cx + 14} y={cy} size={12} weight={800} fill={lit ? '#FFFFFF' : '#5B21B6'} spacing={0.5}>COVERED WALKWAY</Txt>
                    </>
                  ) : (
                    R(r, { fill, stroke: edge, strokeWidth: a.ref === 'protocol' ? 1.5 : thick, rx: a.ref === 'protocol' ? 8 : 6 })
                  )}
                  {cov && !['protocol', 'apostle', 'screen'].includes(a.ref) && (() => { const q = P.rect(r); return <circle cx={q.x + q.w - 14} cy={q.y + 14} r={9} fill={cov.solid} stroke="#FFFFFF" strokeWidth={2.5} pointerEvents="none" /> })()}
                  {a.ref === 'worship' && <><Txt o={orient} x={cx} y={cy} dy={-11} size={20} fill={txt}>Worship</Txt><Txt o={orient} x={cx} y={cy} dy={11} size={20} fill={txt}>team</Txt></>}
                  {a.ref === 'altar' && (
                    <>
                      <Txt o={orient} x={cx} y={cy} dy={-46} size={16} weight={500} fill={txt}>Pulpit and</Txt>
                      <Txt o={orient} x={cx} y={cy} dy={-26} size={16} weight={500} fill={txt}>platform</Txt>
                      <Txt o={orient} x={cx} y={cy} dy={6} size={31} weight={800} fill={txt}>ALTAR</Txt>
                      <Txt o={orient} x={cx} y={cy} dy={36} size={14} weight={700} fill={txt}>30 m wide</Txt>
                      <Txt o={orient} x={r.x + 8} y={cy} size={11} weight={600} land={-90} port={0} fill={txt}>30 m</Txt>
                    </>
                  )}
                  {a.ref === 'tech' && <><Txt o={orient} x={cx} y={cy} dy={-9} size={16} weight={800} fill={txt}>TECHNICAL</Txt><Txt o={orient} x={cx} y={cy} dy={11} size={13} weight={500} fill={lit ? '#FFFFFF' : '#4B5263'}>space</Txt></>}
                  {a.ref === 'protocol' && <Txt o={orient} x={cx} y={cy} size={10} weight={700} land={-90} port={0} fill={txt}>Protocols</Txt>}
                </g>
              )
            })}
            <Txt o={orient} x={1473} y={637} size={11} weight={800} fill="#1F2430">SCREEN</Txt>
            <Txt o={orient} x={1473} y={651} size={9} weight={500} fill="#4B5263">1 m deep</Txt>

            {/* usher seats */}
            {spots.map((sp) => {
              const p = P.pt(sp.x, sp.y)
              const who = occupants?.[sp.positionId]
              const away = !who ? uncovered?.[sp.positionId] : undefined
              const mine = sp.positionId === highlightPositionId
              const inFocus = !!focusId && sp.zoneId === focusId
              const faded = mode === 'locate' && !inFocus
              const tappable = !!onSelectSpot
              const hov = hoverSpot === sp.positionId
              return (
                <g
                  key={sp.positionId}
                  opacity={faded ? 0.35 : 1}
                  {...(tappable ? {
                    role: 'button', tabIndex: 0, 'aria-label': `${sp.zoneName}, ${sp.name}: ${who ?? (away ? `open, ${away} can't make it` : 'open')}`,
                    onClick: (e: React.MouseEvent) => { e.stopPropagation(); if (!moved.current) onSelectSpot!(sp.zoneId, sp.positionId) },
                    onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelectSpot!(sp.zoneId, sp.positionId)),
                    className: 'cursor-pointer outline-none',
                  } : { pointerEvents: mode === 'locate' ? 'none' : undefined })}
                  onMouseEnter={() => setHoverSpot(sp.positionId)}
                  onMouseLeave={() => setHoverSpot((h) => (h === sp.positionId ? null : h))}
                >
                  {tappable && <circle cx={p.x} cy={p.y} r={14} fill="transparent" />}
                  <circle
                    cx={p.x} cy={p.y} r={mine ? 10 : 7}
                    fill={mine ? '#93304E' : who ? '#F2A31B' : away ? '#FFE4E6' : '#FFFFFF'}
                    stroke={hov ? '#111827' : mine ? '#FFFFFF' : who ? '#8A5A08' : away ? '#D8263A' : '#C98A12'}
                    strokeWidth={hov ? 3 : away ? 2.5 : 2}
                    strokeDasharray={who || mine ? undefined : '3 2'}
                  />
                </g>
              )
            })}

            {/* doors */}
            {DOORS.map((d) => <DoorMark key={d.ref} d={d} P={P} o={orient} zone={zoneFor(d.ref)} focus={isFocus(d.ref)} hover={hover === d.ref} dimmed={dim(d.ref)} mode={mode} coverage={coverageOf(d.ref)} hit={hit(d.ref, `Door ${d.ref}, ${DOOR_KIND_LABEL[d.kind].toLowerCase()}`)} />)}
            <g pointerEvents="none">
              {DOORS.filter((d) => d.kind === 'closed').map((d) => ['CLOSED', 'DURING', 'SERVICE'].map((t, i) => (
                <Txt key={d.ref + t} o={orient} x={d.label.x} y={d.label.y} dy={orient === 'landscape' ? 25 + i * 12 : 0} size={10} weight={800} fill="#E8711A" land={0} port={0}>{orient === 'landscape' ? t : ''}</Txt>
              )))}
              {orient === 'portrait' && DOORS.filter((d) => d.kind === 'closed').map((d) => (
                <Txt key={d.ref + 'p'} o={orient} x={d.label.x} y={d.label.y} dy={24} size={10} weight={800} fill="#E8711A">CLOSED</Txt>
              ))}
              {DOORS.filter((d) => d.kind === 'twoway').map((d) => {
                const p = P.pt(d.label.x + 37, d.label.y)
                const v = orient === 'landscape'
                return (
                  <g key={d.ref}>
                    <Txt o={orient} x={d.label.x} y={54} size={11} weight={800} fill="#D8263A" port={-90}>ENTRANCE / EXIT</Txt>
                    <path d={v ? `M${p.x} ${p.y - 13}V${p.y + 13}M${p.x - 5} ${p.y - 7}L${p.x} ${p.y - 13}L${p.x + 5} ${p.y - 7}M${p.x - 5} ${p.y + 7}L${p.x} ${p.y + 13}L${p.x + 5} ${p.y + 7}` : `M${p.x - 13} ${p.y}H${p.x + 13}M${p.x - 7} ${p.y - 5}L${p.x - 13} ${p.y}L${p.x - 7} ${p.y + 5}M${p.x + 7} ${p.y - 5}L${p.x + 13} ${p.y}L${p.x + 7} ${p.y + 5}`} stroke="#D8263A" strokeWidth={2} fill="none" />
                  </g>
                )
              })}
              {DOORS.filter((d) => d.kind === 'workers').map((d) => (
                <Txt key={d.ref} o={orient} x={d.label.x} y={1298} size={10} weight={800} fill="#0F6B58" port={-90}>WORKERS ONLY</Txt>
              ))}
              {(() => { const p = DOORS.find((d) => d.ref === 'M1')!; return <><Txt o={orient} x={p.label.x} y={p.label.y} dy={26} size={11} weight={500} fill="#4B5263">to</Txt><Txt o={orient} x={p.label.x} y={p.label.y} dy={40} size={11} weight={500} fill="#4B5263">Rotunda</Txt></> })()}
            </g>

            {/* nave labels */}
            {NAVES.map((n) => {
              const a = P.pt(1512, n.y0 + 6)
              const b = P.pt(1512, n.y1 - 6)
              const t0 = P.pt(1504, n.y0)
              const t1 = P.pt(1520, n.y0)
              return (
                <g key={n.name} pointerEvents="none">
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#C4C9D4" strokeWidth={1.5} />
                  <line x1={t0.x} y1={t0.y} x2={t1.x} y2={t1.y} stroke="#9AA3B5" strokeWidth={1.5} />
                  <rect {...(() => { const c = P.pt(1512, (n.y0 + n.y1) / 2); return orient === 'landscape' ? { x: c.x - 11, y: c.y - 62, width: 22, height: 124 } : { x: c.x - 62, y: c.y - 11, width: 124, height: 22 } })()} fill="#F4F6FA" />
                  <Txt o={orient} x={1512} y={(n.y0 + n.y1) / 2} size={13} weight={700} fill="#6B7280" land={-90} port={0} spacing={1}>{`${n.name} · ${n.size}`}</Txt>
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
              {orient === 'portrait' ? 'The altar is at the top of the plan.' : 'The altar is on the right of the plan.'}
            </p>
          ) : hoveredSpot ? (
            <>
              <p className="truncate font-semibold text-ink-900">{hoveredSpot.zoneName}<span className="font-normal text-ink-500"> · {hoveredSpot.name}</span></p>
              <p className="truncate text-ink-500">{occupants?.[hoveredSpot.positionId] ?? (uncovered?.[hoveredSpot.positionId] ? `Open: ${uncovered[hoveredSpot.positionId]} can't make it` : 'Open seat')}{onSelectSpot ? ' · tap to assign' : ''}</p>
            </>
          ) : activeZone ? (
            <>
              <p className="truncate font-semibold text-ink-900">{activeZone.name}{zoneNote(activeZone) && <span className="font-normal text-ink-500"> · {zoneNote(activeZone)}</span>}</p>
              {info[activeZone.id] && (
                <p className="text-ink-500 tabular">
                  {info[activeZone.id].assigned ?? 0}{info[activeZone.id].required ? ` of ${info[activeZone.id].required}` : ''} ushers
                  {info[activeZone.id].coverage != null && ` · ${info[activeZone.id].coverage}% staffed`}
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
                placeholder="Section 14, A3, D4"
                className="field h-10 w-44 pl-8 text-sm"
                enterKeyHint="go"
              />
            </label>
            <button onClick={goFind} className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink-700 hover:border-line-strong">Find</button>
          </div>
        )}
      </div>
      </div>

      {mode === 'coverage' && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
          <span className="font-medium text-ink-700">Badge colour:</span>
          {[98, 90, 50].map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: tone(c).solid }} />
              {tone(c).label}
            </span>
          ))}
        </div>
      )}
      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
          {[
            ['#2F5DD3', 'Seating, 11 rows of 12'],
            ['#34A853', 'International guests'],
            ['#E5486F', 'Lady Sandra’s'],
            ['#3A3D44', 'Ministers & HODs'],
            ['#17A2B8', 'Protocols'],
            ['#F08A1C', 'Media & technical'],
            ['#2E9E5B', 'Aisle door'],
            ['#F28C1B', 'Closed during service'],
            ['#D8263A', 'Entrance & exit'],
            ['#0F6B58', 'Workers only'],
            ['#7C3AED', 'Access door (M1–M3)'],
          ].map(([c, l]) => (
            <span key={l} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{l}</span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded-sm border border-dashed border-[#F08A1C]" />Outer section, 11 × 11</span>
          {spots.length > 0 && (
            <>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-[#8A5A08] bg-[#F2A31B]" />Usher seat, filled</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-[#C98A12] bg-white" />Usher seat, open</span>
              {uncovered && Object.keys(uncovered).length > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-[#D8263A] bg-[#FFE4E6]" />Needs cover</span>}
            </>
          )}
          <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-ink-700" />Tent line (pillars, not an aisle)</span>
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


function DoorMark({ d, P, o, zone, focus, hover, dimmed, mode, coverage, hit }: {
  d: Door
  P: ReturnType<typeof project>
  o: Orient
  zone?: Zone
  focus: boolean
  hover: boolean
  dimmed: boolean
  mode: MapMode
  coverage?: number
  hit: Record<string, unknown>
}) {
  const B = PLAN.building
  const color = focus && mode === 'locate' ? '#93304E' : DOOR_COLOR[d.kind]
  const status = mode === 'coverage' && zone ? tone(coverage).solid : undefined
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
  const bw = 50
  const bh = 30
  return (
    <g {...hit} opacity={dimmed ? 0.5 : 1}>
      <rect x={Math.min(r.x, lp.x - bw / 2) - 6} y={Math.min(r.y, lp.y - bh / 2) - 6} width={Math.max(r.x + r.w, lp.x + bw / 2) - Math.min(r.x, lp.x - bw / 2) + 12} height={Math.max(r.y + r.h, lp.y + bh / 2) - Math.min(r.y, lp.y - bh / 2) + 12} fill="transparent" />
      <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#FFFFFF" strokeWidth={8} />
      <path d={swing} fill={`${color}22`} stroke={color} strokeWidth={2} />
      <rect x={lp.x - bw / 2} y={lp.y - bh / 2} width={bw} height={bh} rx={bh / 2} fill={color} stroke={focus || hover ? '#111827' : '#FFFFFF'} strokeWidth={focus || hover ? 3.5 : 2} />
      <Txt o={o} x={d.label.x} y={d.label.y} size={16} weight={800} fill="#FFFFFF">{d.ref}</Txt>
      {status && <circle cx={lp.x + bw / 2 - 2} cy={lp.y - bh / 2 + 2} r={8} fill={status} stroke="#FFFFFF" strokeWidth={2.5} />}
    </g>
  )
}
