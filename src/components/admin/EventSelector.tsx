import { Check, ChevronsUpDown } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Popover } from '@/components/ui/misc'
import { StatusBadge } from '@/components/ui/Badge'
import { cn, formatShortDate } from '@/lib/utils'

export function EventSelector({ value, onChange, className }: { value?: string; onChange?: (id: string) => void; className?: string }) {
  const events = useStore((s) => s.events)
  const activeEventId = useStore((s) => s.activeEventId)
  const setActive = useStore((s) => s.setActiveEvent)
  const current = value ?? activeEventId
  const change = onChange ?? setActive
  const ev = events.find((e) => e.id === current)
  const list = events.filter((e) => e.status !== 'archived').sort((a, b) => b.date.localeCompare(a.date))
  return (
    <Popover
      align="left"
      className="w-80 p-1.5"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-haspopup="listbox" aria-expanded={open} className={cn('flex h-9 items-center gap-2 rounded-[10px] border border-line bg-white pl-3 pr-2 text-sm shadow-soft hover:border-line-strong', className)}>
          <span className={cn('h-2 w-2 rounded-full', ev?.rosterStatus === 'published' ? 'bg-ok-500' : 'bg-warn-500')} aria-hidden />
          <span className="max-w-[160px] truncate font-semibold text-ink-900">{ev?.code ?? 'Select event'}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-ink-400" />
        </button>
      )}
    >
      {(close) => (
        <ul role="listbox" aria-label="Events">
          <li className="eyebrow px-2.5 pb-1.5 pt-1.5">Working on</li>
          {list.map((e) => (
            <li key={e.id}>
              <button role="option" aria-selected={e.id === current} onClick={() => { change(e.id); close() }} className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-paper', e.id === current && 'bg-paper')}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink-900">{e.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">{formatShortDate(e.date)}</div>
                </div>
                <StatusBadge status={e.rosterStatus === 'published' ? 'published' : 'unpublished'} />
                {e.id === current ? <Check className="h-4 w-4 text-wine-600" /> : <span className="w-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  )
}
