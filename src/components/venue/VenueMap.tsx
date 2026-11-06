import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Crosshair, Maximize2, Minus, Plus, RotateCw, Search } from 'lucide-react'
import type { Position, Zone } from '@/data/types'
import {
  AREAS, DOORS, LANE_AISLES, NAVES, PILLAR_X, PLAN, TENT_ROWS, AISLE_COUNT, SECTION_COUNT,
  aisleCenterY, aisleRect, doorRect, hasSpots, isNewSection, nearestEntrance, refRect, sectionOfRef, sectionRect, sectionStyle,
  spotPoint, tentLineY, zoneNote, zoneRef,
  type Door, type Rect,
} from '@/data/venue'
import { cn } from '@/lib/utils'

/**
 * The auditorium floor plan as a tappable schematic: 90 seating sections,
 * aisles 1–6, the tent lines, the doors and the altar-side areas, drawn from
 * the real plan, plus the four usher spots in each section. The spots are
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
}

/* ---------- orientation ---------- */

const XR = PLAN.view.x * 2 + PLAN.view.w // rotation pivot so the turned plan keeps the same margins

type Orient = 'landscape' | 'portrait'
function project(o: Orient) {
  const rect = (r: Rect): Rect => (o === 'landscape' ? r : { x: r.y, y: XR - r.x - r.w, w: r.h, h: r.w })
  const pt = (x: number, y: number) => (o === 'landscape' ? { x, y } : { x: y, y: XR - x })
  return { rect, pt }
}

/* ---------- colours ---------- */

const PLAIN = {
  standard: { fill: '#B7CDF0', edge: '#8DAEE3' },
  international: { fill: '#A9DDB3', edge: '#6CBD7C' },
  lady: { fill: '#F5B6CF', edge: '#D63A7A' },
  ministers: { fill: '#C3C6CD', edge: '#2A2E36' },
  media: { fill: '#FFFFFF', edge: '#2A2E36' },
}
const DOOR_COLOR: Record<Door['kind'], string> = { entrance: '#2E9E5B', exit: '#D8263A', access: '#7C3AED' }
const AREA_COLOR: Record<string, { fill: string; edge: string; text: string }> = {
  worship: { fill: '#C9F5E6', edge: '#2BB58A', text: '#11775A' },
  altar: { fill: '#FFF0B8', edge: '#E9A43B', text: '#8A4B08' },
  tech: { fill: '#FFFFFF', edge: '#1F2430', text: '#1F2430' },
  reserve: { fill: '#E2E3FB', edge: '#8C8FE8', text: '#4B4FB0' },
  apostle: { fill: '#E7A158', edge: '#7C3AED', text: '#7C3AED' },
  protocol: { fill: '#DCEBFF', edge: '#2D6BE0', text: '#1D4FB5' },
  screen: { fill: '#14B8A6', edge: '#0F1B33', text: '#0F1B33' },
  walkway: { fill: '#EDE4FF', edge: '#6D28D9', text: '#4C1D95' },
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

export function VenueMap({ zones, mode = 'plain', highlightZoneId, selectedZoneId, info = {}, onSelect, className, compact, pinLabel = 'You', positions, occupants, highlightPositionId, onSelectSpot }: Props) {
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
    else if (/^A[1-6]$/.test(q)) ref = q
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
  const seatPattern = 'url(#grm-seats)'

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
            aria-label="Auditorium floor plan: 90 seating sections with usher spots, aisles 1 to 6, doors and the altar"
            style={{ fontFamily: 'Manrope, ui-sans-serif, system-ui, sans-serif' }}
          >
            <defs>
              <pattern id="grm-seats" width="7" height="9" patternUnits="userSpaceOnUse" patternTransform={orient === 'portrait' ? 'rotate(90)' : undefined}>
                <path d="M3.5 0V9" stroke="#1E3A6E" strokeOpacity=".22" strokeWidth="2.2" />
                <path d="M0 8.5H7" stroke="#1E3A6E" strokeOpacity=".08" strokeWidth="1" />
              </pattern>
              <pattern id="grm-hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="12" height="12" fill="#EDE4FF" />
                <path d="M0 0V12" stroke="#A78BFA" strokeWidth="4" />
              </pattern>
            </defs>

            {/* building */}
            {R(PLAN.building, { fill: '#F7F8FB', stroke: '#111318', strokeWidth: 7, rx: 8 })}
            {R(PLAN.seating, { fill: '#DCE2EE', rx: 6 })}

            {/* aisles */}
            {Array.from({ length: AISLE_COUNT }, (_, i) => i + 1).map((n) => {
              const ref = `A${n}`
              const r = aisleRect(n)
              const z = zoneFor(ref)
              const focus = isFocus(ref)
              const lane = LANE_AISLES.includes(n)
              const c = mode === 'coverage' && z ? tone(coverageOf(ref)).solid : undefined
              const fill = focus && mode === 'locate' ? '#93304E' : lane ? '#AEC4F0' : '#CBD7EF'
              const cy = aisleCenterY(n)
              return (
                <g key={ref} {...hit(ref, `Aisle ${n}`)} opacity={dim(ref) ? 0.5 : 1}>
                  {R({ x: r.x, y: r.y - 4, w: r.w, h: r.h + 8 }, { fill: 'transparent' })}
                  {R({ x: r.x, y: r.y + 3, w: r.w, h: r.h - 6 }, { fill, rx: 4, stroke: focus || hover === ref ? '#111827' : 'none', strokeWidth: 4 })}
                  {[432, 764, 1098].map((x) => (
                    <Txt o={orient} key={x} x={x} y={cy} size={16} fill={focus && mode === 'locate' ? '#FFFFFF' : '#2D5BD0'} land={0} port={-90} spacing={1}>AISLE {n}</Txt>
                  ))}
                  {(() => {
                    const p = P.pt(208, cy)
                    return (
                      <g>
                        <circle cx={p.x} cy={p.y} r={30} fill="transparent" />
                        <circle cx={p.x} cy={p.y} r={16} fill={focus && mode === 'locate' ? '#93304E' : c ?? '#0F1B33'} stroke="#FFFFFF" strokeWidth={3} />
                      </g>
                    )
                  })()}
                  <Txt o={orient} x={208} y={cy} size={17} fill="#FFFFFF">{n}</Txt>
                </g>
              )
            })}

            {/* tent lines: a chair column removed for the iron pillars, not an aisle */}
            {TENT_ROWS.map((row) => {
              const y = tentLineY(row)
              const a = P.pt(PILLAR_X[0], y)
              const b = P.pt(PILLAR_X[PILLAR_X.length - 1], y)
              return (
                <g key={row} pointerEvents="none" opacity={mode === 'locate' ? 0.6 : 1}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2A2E36" strokeWidth="2.5" strokeDasharray="10 7" />
                  {PILLAR_X.map((x) => {
                    const p = P.pt(x, y)
                    return (
                      <g key={x}>
                        <circle cx={p.x} cy={p.y} r={11} fill="#C9B98F" stroke="#2A2E36" strokeWidth={2.5} />
                        <circle cx={p.x} cy={p.y} r={4} fill="#2A2E36" />
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
              const col = sectionColors(n)
              const style = sectionStyle(n)
              const focus = isFocus(ref)
              const plainish = !(mode === 'locate' && focus)
              const badge = mode === 'coverage' && zoneFor(ref) ? tone(coverageOf(ref)).solid : '#0F1B33'
              const cx = r.x + r.w / 2
              const cy = r.y + r.h / 2
              const side = style === 'lady' || style === 'ministers'
              const offset = side || n === 5 ? cx - 14 : cx
              return (
                <g key={ref} {...hit(ref, `Section ${n}`)} opacity={dim(ref) ? 0.42 : 1}>
                  {isNewSection(n) && R({ x: r.x - 5, y: r.y - 5, w: r.w + 10, h: r.h + 10 }, { fill: 'none', stroke: '#E58A2B', strokeWidth: 2, strokeDasharray: '6 5', rx: 4, pointerEvents: 'none' })}
                  {style === 'media' && plainish ? (
                    <>
                      {R({ x: r.x, y: r.y, w: r.w / 2, h: r.h }, { fill: '#FFFFFF', stroke: '#2A2E36', strokeWidth: 2.5 })}
                      {R({ x: r.x + r.w / 2, y: r.y, w: r.w / 2, h: r.h }, { fill: '#FFE6CC', stroke: '#B45309', strokeWidth: 2.5 })}
                      {(focus || hover === ref) && R(r, { fill: 'none', stroke: '#111827', strokeWidth: 5 })}
                    </>
                  ) : (
                    R(r, { fill: col.fill, stroke: focus || hover === ref ? '#111827' : col.edge, strokeWidth: focus || hover === ref ? 5 : 2, rx: 3 })
                  )}
                  {R({ x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 }, { fill: seatPattern, pointerEvents: 'none', opacity: style === 'media' && plainish ? 0 : 1 })}
                  {style === 'media' && plainish ? (
                    <>
                      {(() => { const p = P.pt(cx, r.y + 18); return <rect x={p.x - 22} y={p.y - 14} width={44} height={28} rx={14} fill={badge} pointerEvents="none" /> })()}
                      <Txt o={orient} x={cx} y={r.y + 18} size={17} fill="#FFFFFF">{n}</Txt>
                      <Txt o={orient} x={r.x + r.w / 4} y={r.y + 62} size={12} land={-90} port={0} fill="#1F2430">TECHNICAL</Txt>
                      <Txt o={orient} x={r.x + (3 * r.w) / 4} y={r.y + 62} size={13} land={-90} port={0} fill="#B45309" weight={800}>MEDIA</Txt>
                    </>
                  ) : (
                    <>
                      {side && plainish && R({ x: r.x + r.w - 26, y: r.y + 5, w: 21, h: r.h - 10 }, { fill: '#FFFFFF', stroke: col.edge, strokeWidth: 2, rx: 6, pointerEvents: 'none' })}
                      {side && plainish && (
                        <Txt o={orient} x={r.x + r.w - 15.5} y={cy} size={style === 'lady' ? 12 : 14} land={-90} port={0} fill={style === 'lady' ? '#B0245E' : '#111318'}>
                          {style === 'lady' ? 'Lady Sandra’s' : 'Ministers'}
                        </Txt>
                      )}
                      {(() => {
                        const p = P.pt(offset, cy)
                        return <rect x={p.x - 28} y={p.y - 20} width={56} height={40} rx={20} fill={focus && mode === 'locate' ? '#FFFFFF' : badge} pointerEvents="none" />
                      })()}
                      <Txt o={orient} x={offset} y={cy} size={25} weight={800} fill={focus && mode === 'locate' ? '#93304E' : '#FFFFFF'}>{n}</Txt>
                    </>
                  )}
                </g>
              )
            })}

            {/* areas beside the altar */}
            {AREAS.map((a) => {
              const z = zoneFor(a.ref)
              const focus = isFocus(a.ref)
              const c = AREA_COLOR[a.ref]
              const cov = mode === 'coverage' && z ? tone(coverageOf(a.ref)) : undefined
              const fill = focus && mode === 'locate' ? '#93304E' : c.fill
              const r = a.rect
              const cx = r.x + r.w / 2
              const cy = r.y + r.h / 2
              const txt = focus && mode === 'locate' ? '#FFFFFF' : c.text
              const edge = focus || hover === a.ref ? '#111827' : c.edge
              const thick = focus || hover === a.ref ? 4.5 : 2.5
              return (
                <g key={a.ref} {...hit(a.ref, a.name)} opacity={dim(a.ref) ? 0.5 : 1}>
                  {a.ref === 'apostle' && R({ x: r.x - 2, y: r.y - 90, w: 70, h: r.h + 180 }, { fill: 'transparent' })}
                  {a.ref === 'screen' && R({ x: r.x - 4, y: r.y, w: r.w + 8, h: r.h }, { fill: 'transparent' })}
                  {a.ref === 'apostle' ? (
                    <>
                      {R(r, { fill: '#FFFFFF', stroke: edge, strokeWidth: focus || hover === a.ref ? 4 : 2, rx: 4 })}
                      {Array.from({ length: 9 }, (_, i) => <g key={i}>{R({ x: r.x + 4, y: r.y + 4 + i * 9.4, w: r.w - 8, h: 7, }, { fill: focus && mode === 'locate' ? '#93304E' : '#E7A158', rx: 2, pointerEvents: 'none' })}</g>)}
                      <Txt o={orient} x={1365} y={cy - 5} size={18} land={-90} port={0} fill={c.text}>Apostle and guest ministers</Txt>
                    </>
                  ) : a.ref === 'screen' ? (
                    <>
                      {['#1D4ED8', '#14B8A6', '#6D28D9', '#14B8A6', '#1D4ED8'].map((f, i) => <g key={i}>{R({ x: r.x, y: r.y + (i * r.h) / 5, w: r.w, h: r.h / 5 - 2 }, { fill: focus && mode === 'locate' ? '#93304E' : f, pointerEvents: 'none' })}</g>)}
                      {R(r, { fill: 'none', stroke: edge, strokeWidth: focus || hover === a.ref ? 3 : 1.5 })}
                    </>
                  ) : a.ref === 'walkway' ? (
                    <>
                      {R(r, { fill: focus && mode === 'locate' ? '#93304E' : 'url(#grm-hatch)', stroke: edge, strokeWidth: thick })}
                      {(() => {
                        const p = P.pt(r.x + 24, cy)
                        const q = orient === 'landscape'
                          ? `M${p.x - 12} ${p.y}L${p.x + 8} ${p.y - 12}L${p.x + 8} ${p.y + 12}Z`
                          : `M${p.x} ${p.y + 12}L${p.x - 12} ${p.y - 8}L${p.x + 12} ${p.y - 8}Z`
                        return <path d={q} fill="#6D28D9" pointerEvents="none" />
                      })()}
                      <Txt o={orient} x={cx + 12} y={cy} size={orient === 'portrait' ? 13 : 15} weight={800} fill={focus && mode === 'locate' ? '#FFFFFF' : '#4C1D95'} spacing={1}>COVERED WALKWAY</Txt>
                    </>
                  ) : (
                    R(r, { fill, stroke: edge, strokeWidth: thick, rx: a.ref === 'protocol' ? 5 : 8 })
                  )}
                  {cov && !['protocol', 'apostle', 'screen'].includes(a.ref) && (() => { const q = P.rect(r); return <circle cx={q.x + q.w - 16} cy={q.y + 16} r={10} fill={cov.solid} stroke="#FFFFFF" strokeWidth={3} pointerEvents="none" /> })()}
                  {a.ref === 'worship' && <><Txt o={orient} x={cx} y={cy} dy={-17} size={28} fill={txt}>Worship</Txt><Txt o={orient} x={cx} y={cy} dy={17} size={28} fill={txt}>team</Txt></>}
                  {a.ref === 'altar' && (
                    <>
                      <Txt o={orient} x={cx} y={cy} dy={-62} size={21} weight={600} fill={txt}>Pulpit and</Txt>
                      <Txt o={orient} x={cx} y={cy} dy={-37} size={21} weight={600} fill={txt}>platform</Txt>
                      <Txt o={orient} x={cx} y={cy} dy={8} size={38} weight={800} fill={txt}>ALTAR</Txt>
                      <Txt o={orient} x={cx} y={cy} dy={46} size={18} weight={700} fill={txt}>30 m wide</Txt>
                    </>
                  )}
                  {a.ref === 'tech' && <><Txt o={orient} x={cx} y={cy} dy={-12} size={orient === 'portrait' ? 16 : 19} weight={800} fill={txt}>TECHNICAL</Txt><Txt o={orient} x={cx} y={cy} dy={14} size={16} weight={500} fill={txt}>space</Txt></>}
                  {a.ref === 'protocol' && <Txt o={orient} x={cx} y={cy} size={12} land={-90} port={0} fill={focus && mode === 'locate' ? '#FFFFFF' : c.text}>Protocols</Txt>}
                </g>
              )
            })}
            <Txt o={orient} x={1652} y={690} size={15} weight={800} fill="#1F2430">SCREEN</Txt>
            <Txt o={orient} x={1652} y={690} dy={22} size={13} weight={500} fill="#4B5263">1 m deep</Txt>

            {/* usher spots */}
            {spots.map((sp) => {
              const p = P.pt(sp.x, sp.y)
              const who = occupants?.[sp.positionId]
              const mine = sp.positionId === highlightPositionId
              const inFocus = !!focusId && sp.zoneId === focusId
              const faded = mode === 'locate' && !inFocus
              const tappable = !!onSelectSpot
              return (
                <g
                  key={sp.positionId}
                  opacity={faded ? 0.35 : 1}
                  {...(tappable ? {
                    role: 'button', tabIndex: 0, 'aria-label': `${sp.zoneName}, ${sp.name}: ${who ?? 'open'}`,
                    onClick: (e: React.MouseEvent) => { e.stopPropagation(); if (!moved.current) onSelectSpot!(sp.zoneId, sp.positionId) },
                    onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelectSpot!(sp.zoneId, sp.positionId)),
                    className: 'cursor-pointer outline-none',
                  } : { pointerEvents: mode === 'locate' ? 'none' : undefined })}
                  onMouseEnter={() => setHoverSpot(sp.positionId)}
                  onMouseLeave={() => setHoverSpot((h) => (h === sp.positionId ? null : h))}
                >
                  {tappable && <circle cx={p.x} cy={p.y} r={17} fill="transparent" />}
                  <circle
                    cx={p.x} cy={p.y} r={mine ? 13 : 10}
                    fill={mine ? '#93304E' : who ? '#F2B42C' : '#FFFFFF'}
                    stroke={hoverSpot === sp.positionId ? '#111827' : mine ? '#FFFFFF' : who ? '#8A6110' : '#C9971F'}
                    strokeWidth={hoverSpot === sp.positionId ? 4 : who || mine ? 2.5 : 2.5}
                    strokeDasharray={who || mine ? undefined : '3 2.5'}
                  />
                </g>
              )
            })}

            {/* doors */}
            {DOORS.map((d) => <DoorMark key={d.ref} d={d} P={P} o={orient} zone={zoneFor(d.ref)} focus={isFocus(d.ref)} hover={hover === d.ref} dimmed={dim(d.ref)} mode={mode} coverage={coverageOf(d.ref)} hit={hit(d.ref, `Door ${d.ref}`)} />)}
            {(() => { const p = DOORS.find((d) => d.ref === 'M1')!; return <><Txt o={orient} x={p.label.x} y={p.label.y} dy={34} size={15} weight={500} fill="#4B5263">to</Txt><Txt o={orient} x={p.label.x} y={p.label.y} dy={54} size={15} weight={500} fill="#4B5263">Rotunda</Txt></> })()}

            {/* nave labels */}
            {NAVES.map((n) => {
              const a = P.pt(1730, n.y0 + 6)
              const b = P.pt(1730, n.y1 - 6)
              const t0 = P.pt(1720, n.y0)
              const t1 = P.pt(1740, n.y0)
              return (
                <g key={n.name} pointerEvents="none">
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#C4C9D4" strokeWidth={2} />
                  <line x1={t0.x} y1={t0.y} x2={t1.x} y2={t1.y} stroke="#9AA3B5" strokeWidth={2} />
                  <rect {...(() => { const c = P.pt(1730, (n.y0 + n.y1) / 2); return orient === 'landscape' ? { x: c.x - 14, y: c.y - 85, width: 28, height: 170 } : { x: c.x - 85, y: c.y - 14, width: 170, height: 28 } })()} fill="#F4F6FA" />
                  <Txt o={orient} x={1730} y={(n.y0 + n.y1) / 2} size={18} weight={700} fill="#6B7280" land={-90} port={0} spacing={1}>{`${n.name} · ${n.size}`}</Txt>
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
              {mySpot && <>Your spot is the <span className="font-semibold text-wine-600">{mySpot.name.toLowerCase()}</span> of {mySpot.zoneName}, facing the altar. </>}
              {entrance ? <>Come in through <span className="font-semibold text-ok-600">door {entrance.ref}</span>. </> : null}
              {orient === 'portrait' ? 'The altar is at the top of the plan.' : 'The altar is on the right of the plan.'}
            </p>
          ) : hoveredSpot ? (
            <>
              <p className="truncate font-semibold text-ink-900">{hoveredSpot.zoneName}<span className="font-normal text-ink-500"> · {hoveredSpot.name}</span></p>
              <p className="truncate text-ink-500">{occupants?.[hoveredSpot.positionId] ?? 'Open spot'}{onSelectSpot ? ' · tap to assign' : ''}</p>
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
            <p className="text-ink-500">{interactive ? `Tap a section, aisle or door${onSelectSpot ? ', or zoom in and tap an usher spot' : ''}. Pinch or double-tap to zoom.` : 'Pinch or double-tap to zoom.'}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* controls */}
          {(!compact || highlightRef || view.k > 1) && (
          <div className="flex shrink-0 overflow-hidden rounded-xl border border-line bg-white shadow-soft">
            {!compact && <MapBtn label="Zoom in" onClick={() => zoomAt(view.k * 1.6, (box.current?.clientWidth ?? 0) / 2, (box.current?.clientHeight ?? 0) / 2)} disabled={view.k >= MAX_K}><Plus className="h-4 w-4" /></MapBtn>}
            {!compact && <MapBtn label="Zoom out" onClick={() => zoomAt(view.k / 1.6, (box.current?.clientWidth ?? 0) / 2, (box.current?.clientHeight ?? 0) / 2)} disabled={view.k <= 1}><Minus className="h-4 w-4" /></MapBtn>}
            {highlightRef && <MapBtn label="Zoom to my spot" onClick={() => (mySpot ? zoomToPoint(mySpot.x, mySpot.y, 3.4) : zoomToRef(highlightRef, 2.8))}><Crosshair className="h-4 w-4" /></MapBtn>}
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
                placeholder="Section 14, A3, E1"
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
            ['#B7CDF0', 'Seating, 160 per section'],
            ['#A9DDB3', 'International guests'],
            ['#F5B6CF', 'Lady Sandra’s'],
            ['#C3C6CD', 'Ministers & HODs'],
            ['#2E9E5B', 'Entrance'],
            ['#D8263A', 'Exit'],
            ['#7C3AED', 'Ministers’ access'],
          ].map(([c, l]) => (
            <span key={l} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{l}</span>
          ))}
          {spots.length > 0 && (
            <>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-[#8A6110] bg-[#F2B42C]" />Usher spot, filled</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-[#C9971F] bg-white" />Usher spot, open</span>
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
  // wall line point (t along the opening) and the inward normal
  const wall = (t: number) => {
    if (d.side === 'top') return { x: t, y: B.y }
    if (d.side === 'bottom') return { x: t, y: B.y + B.h }
    if (d.side === 'left') return { x: B.x, y: t }
    return { x: B.x + B.w, y: t }
  }
  const n = d.side === 'top' ? { x: 0, y: 1 } : d.side === 'bottom' ? { x: 0, y: -1 } : d.side === 'left' ? { x: 1, y: 0 } : { x: -1, y: 0 }
  const a = wall(d.a)
  const b = wall(d.b)
  const m = wall(d.a + half)
  const leaf = (h: { x: number; y: number }) => P.pt(h.x + n.x * half, h.y + n.y * half)
  const pa = P.pt(a.x, a.y)
  const pb = P.pt(b.x, b.y)
  const pm = P.pt(m.x, m.y)
  const la = leaf(a)
  const lb = leaf(b)
  // sweep direction depends on which way the wall runs; it is preserved by the rotation
  const sweepA = d.side === 'top' || d.side === 'right' ? 0 : 1
  const sweepB = 1 - sweepA
  const swing = `M${pa.x} ${pa.y}L${la.x} ${la.y}A${half} ${half} 0 0 ${sweepA} ${pm.x} ${pm.y}M${pb.x} ${pb.y}L${lb.x} ${lb.y}A${half} ${half} 0 0 ${sweepB} ${pm.x} ${pm.y}`
  const lp = P.pt(d.label.x, d.label.y)
  const r = P.rect(doorRect(d))
  const bw = 66
  const bh = 40
  return (
    <g {...hit} opacity={dimmed ? 0.5 : 1}>
      <rect x={Math.min(r.x, lp.x - bw / 2) - 8} y={Math.min(r.y, lp.y - bh / 2) - 8} width={Math.max(r.x + r.w, lp.x + bw / 2) - Math.min(r.x, lp.x - bw / 2) + 16} height={Math.max(r.y + r.h, lp.y + bh / 2) - Math.min(r.y, lp.y - bh / 2) + 16} fill="transparent" />
      <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#F7F8FB" strokeWidth={9} />
      <path d={swing} fill="none" stroke={color} strokeWidth={3} />
      <rect x={lp.x - bw / 2} y={lp.y - bh / 2} width={bw} height={bh} rx={bh / 2} fill={color} stroke={focus || hover ? '#111827' : '#FFFFFF'} strokeWidth={focus || hover ? 4 : 2} />
      <Txt o={o} x={d.label.x} y={d.label.y} size={21} weight={800} fill="#FFFFFF">{d.ref}</Txt>
      {status && <circle cx={lp.x + bw / 2 - 2} cy={lp.y - bh / 2 + 2} r={9} fill={status} stroke="#FFFFFF" strokeWidth={3} />}
    </g>
  )
}
