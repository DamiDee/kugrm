import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

export type SortDir = 'asc' | 'desc'

export function SortHeader({ label, k, sort, onSort, className }: { label: string; k: string; sort: { key: string; dir: SortDir }; onSort: (k: string) => void; className?: string }) {
  const active = sort.key === k
  return (
    <th scope="col" className={cn('px-4 py-3 text-left text-xs font-medium text-ink-500', className)} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => onSort(k)} className={cn('inline-flex items-center gap-1 hover:text-ink-900', active && 'text-ink-900')}>
        {label}
        {active && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  )
}

export function Pagination({ page, pages, total, perPage, onPage }: { page: number; pages: number; total: number; perPage: number; onPage: (p: number) => void }) {
  if (total === 0) return null
  const from = (page - 1) * perPage + 1
  const to = Math.min(total, page * perPage)
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3 text-sm text-ink-500">
      <span className="tabular">{from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}</span>
      <div className="flex items-center gap-1">
        <Button size="icon-sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="px-2 tabular">{page} / {pages}</span>
        <Button size="icon-sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}

export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-x-3 bottom-4 z-30 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl bg-ink-900 p-2 pl-4 text-white shadow-float sm:inset-x-6"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="mr-auto text-sm"><span className="font-semibold tabular">{count}</span> selected</span>
          {children}
          <button onClick={onClear} className="rounded-lg px-3 py-2 text-sm text-white/60 hover:text-white">Clear</button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function BulkButton({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors', danger ? 'text-[#FFB4B4] hover:bg-bad-500/20' : 'bg-white/10 hover:bg-white/15')}>
      {children}
    </button>
  )
}
