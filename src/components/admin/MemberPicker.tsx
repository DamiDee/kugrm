import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { EventData } from '@/lib/selectors'
import { cn, formatPhone, fullName, normalizePhone } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'

/** Searchable member dropdown that stays quick across thousands of members. */
export function MemberPicker({ value, onChange, data, autoFocus, onlyUnassigned }: { value: string; onChange: (id: string) => void; data: EventData; autoFocus?: boolean; onlyUnassigned?: boolean }) {
  const members = useStore((s) => s.members)
  const [open, setOpen] = useState(!!autoFocus)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = members.find((m) => m.id === value)

  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 20) }, [open])

  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    const d = normalizePhone(q)
    return members
      .filter((m) => m.status === 'active')
      .filter((m) => !onlyUnassigned || !data.byMember.has(m.id))
      .filter((m) => !t || fullName(m).toLowerCase().includes(t) || (d.length >= 3 && m.phone.includes(d)) || m.memberId?.toLowerCase().includes(t))
      .sort((a, b) => Number(data.byMember.has(a.id)) - Number(data.byMember.has(b.id)))
      .slice(0, 40)
  }, [q, members, data.byMember, onlyUnassigned])

  const pick = (id: string) => { onChange(id); setOpen(false); setQ('') }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} className="field flex items-center gap-2.5 text-left">
        {selected ? (
          <>
            <Avatar first={selected.firstName} last={selected.lastName} size="xs" />
            <span className="flex-1 truncate">{fullName(selected)}</span>
            <span className="text-xs text-ink-400 tabular">{formatPhone(selected.phone)}</span>
          </>
        ) : (
          <span className="flex-1 text-ink-400">Search by name, phone or member ID…</span>
        )}
        <ChevronsUpDown className="h-4 w-4 text-ink-400" />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-line bg-white shadow-lift">
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); setIdx(0) }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)) }
                if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)) }
                if (e.key === 'Enter') { e.preventDefault(); results[idx] && pick(results[idx].id) }
                if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
              }}
              placeholder="Type a name or number"
              className="h-10 flex-1 bg-transparent text-sm focus:outline-none"
              aria-label="Search members"
            />
          </div>
          <ul role="listbox" className="scrollbar-thin max-h-64 overflow-y-auto p-1">
            {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-500">No matching members.</li>}
            {results.map((m, i) => {
              const a = data.byMember.get(m.id)
              const z = a && data.zoneById.get(a.zoneId)
              const p = a && data.positionById.get(a.positionId)
              return (
                <li key={m.id}>
                  <button type="button" role="option" aria-selected={m.id === value} onMouseMove={() => setIdx(i)} onClick={() => pick(m.id)} className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left', i === idx && 'bg-paper')}>
                    <Avatar first={m.firstName} last={m.lastName} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink-900">{fullName(m)}</span>
                      <span className="block truncate text-xs text-ink-500 tabular">{formatPhone(m.phone)} · {m.unit}</span>
                    </span>
                    <span className={cn('shrink-0 text-xs', z ? 'text-ink-500' : 'font-medium text-warn-600')}>{z ? `${z.name} · ${p?.name}` : 'Unassigned'}</span>
                    {m.id === value && <Check className="h-4 w-4 text-wine-600" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
