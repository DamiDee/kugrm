import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, CornerDownLeft, LayoutGrid, MapPin, Search, User } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useEventData } from '@/lib/selectors'
import { cn, formatPhone, fullName, normalizePhone } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'

type Item = { id: string; group: string; title: string; sub?: string; icon: React.ReactNode; run: () => void }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const members = useStore((s) => s.members)
  const events = useStore((s) => s.events)
  const activeEventId = useStore((s) => s.activeEventId)
  const setActive = useStore((s) => s.setActiveEvent)
  const data = useEventData(activeEventId)

  useEffect(() => {
    if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30) }
  }, [open])

  const items = useMemo<Item[]>(() => {
    const go = (fn: () => void) => () => { fn(); onClose() }
    const term = q.trim().toLowerCase()
    const digits = normalizePhone(q)
    const pages: Item[] = [
      ['Overview', '/admin'], ['Assignments board', '/admin/assignments?view=board'], ['Venue map', '/admin/assignments?view=map'], ['Members', '/admin/members'], ['Events', '/admin/events'], ['Positions', '/admin/positions'], ['Import', '/admin/import'], ['Reports', '/admin/reports'],
    ].map(([t, p]) => ({ id: p, group: 'Go to', title: t, icon: <LayoutGrid className="h-4 w-4" />, run: go(() => navigate(p)) }))
    if (!term) return pages
    const ms = members
      .filter((m) => fullName(m).toLowerCase().includes(term) || (digits.length >= 3 && m.phone.includes(digits)) || m.memberId?.toLowerCase().includes(term))
      .slice(0, 6)
      .map<Item>((m) => {
        const a = data.byMember.get(m.id)
        const z = a && data.zoneById.get(a.zoneId)
        const p = a && data.positionById.get(a.positionId)
        return { id: m.id, group: 'Members', title: fullName(m), sub: `${formatPhone(m.phone)} · ${z ? `${z.name} · ${p?.name}` : 'Unassigned'}`, icon: <Avatar first={m.firstName} last={m.lastName} size="xs" />, run: go(() => navigate(`/admin/members/${m.id}`)) }
      })
    const zs = data.zones.filter((z) => z.name.toLowerCase().includes(term)).slice(0, 5).map<Item>((z) => ({
      id: z.id, group: 'Zones & aisles', title: z.name, sub: `${data.byZone.get(z.id)?.length ?? 0} ushers assigned`, icon: <MapPin className="h-4 w-4" />, run: go(() => navigate(`/admin/assignments?view=board&zone=${z.id}`)),
    }))
    const es = events.filter((e) => (e.name + e.code).toLowerCase().includes(term)).slice(0, 4).map<Item>((e) => ({
      id: e.id, group: 'Events', title: e.name, sub: e.code, icon: <CalendarDays className="h-4 w-4" />, run: go(() => { setActive(e.id); navigate(`/admin/events/${e.id}`) }),
    }))
    return [...ms, ...zs, ...es, ...pages.filter((p) => p.title.toLowerCase().includes(term))]
  }, [q, members, events, data, navigate, onClose, setActive])

  useEffect(() => setIdx(0), [q])
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [idx])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)) }
    if (e.key === 'Enter') { e.preventDefault(); items[idx]?.run() }
    if (e.key === 'Escape') onClose()
  }

  let lastGroup = ''
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-ink-950/35 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-label="Search"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-float ring-1 ring-ink-900/5"
            onKeyDown={onKey}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="h-4 w-4 text-ink-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search members, phone numbers, aisles, events…"
                className="h-14 flex-1 bg-transparent text-[15px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
                role="combobox"
                aria-expanded="true"
                aria-controls="cmdk-list"
                aria-activedescendant={items[idx] ? `cmdk-${idx}` : undefined}
              />
              <span className="kbd">Esc</span>
            </div>
            <div ref={listRef} id="cmdk-list" role="listbox" className="scrollbar-thin max-h-[52vh] overflow-y-auto p-2">
              {items.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-ink-800">No results for “{q}”</p>
                  <p className="mt-1 text-xs text-ink-500">Try a name, a phone number like 0803, or “Section 14”.</p>
                </div>
              )}
              {items.map((it, i) => {
                const header = it.group !== lastGroup ? it.group : null
                lastGroup = it.group
                return (
                  <div key={it.group + it.id}>
                    {header && <div className="eyebrow px-2.5 pb-1 pt-3">{header}</div>}
                    <button
                      id={`cmdk-${i}`}
                      data-idx={i}
                      role="option"
                      aria-selected={i === idx}
                      onMouseMove={() => setIdx(i)}
                      onClick={it.run}
                      className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left', i === idx ? 'bg-paper ring-1 ring-line' : '')}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-md text-ink-500">{it.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900">{it.title}</span>
                        {it.sub && <span className="block truncate text-xs text-ink-500">{it.sub}</span>}
                      </span>
                      {i === idx && <CornerDownLeft className="h-3.5 w-3.5 text-ink-400" />}
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-4 border-t border-line bg-paper px-4 py-2.5 text-[11px] text-ink-500">
              <span className="flex items-center gap-1"><span className="kbd">↑</span><span className="kbd">↓</span> navigate</span>
              <span className="flex items-center gap-1"><span className="kbd">↵</span> open</span>
              <span className="ml-auto flex items-center gap-1"><User className="h-3 w-3" /> {members.length.toLocaleString()} members indexed</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
