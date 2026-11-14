import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Plus, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { EventData } from '@/lib/selectors'
import { useMemberMap } from '@/lib/selectors'
import { cn, formatPhone, fullName } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/misc'
import { ConfirmDialog } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { ZONE_KIND_LABEL, zoneNote } from '@/data/venue'

export function ZonePanel({ zoneId, data, onAssign, onOpenMember, className }: { zoneId: string; data: EventData; onAssign: () => void; onOpenMember?: (id: string) => void; className?: string }) {
  const memberMap = useMemberMap()
  const remove = useStore((s) => s.removeAssignment)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const zs = data.zoneStats.find((z) => z.zone.id === zoneId)
  if (!zs) return null
  const list = data.byZone.get(zoneId) ?? []
  const toRemove = confirmId ? list.find((a) => a.id === confirmId) : undefined
  const removeMember = toRemove && memberMap.get(toRemove.memberId)

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="border-b border-line px-5 pb-4 pt-5">
        <div className="eyebrow">{ZONE_KIND_LABEL[zs.zone.kind]}{zoneNote(zs.zone) && <span className="normal-case tracking-normal"> · {zoneNote(zs.zone)}</span>}</div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold tracking-tight text-ink-900">{zs.zone.name}</h3>
          <Button size="sm" variant="primary" onClick={onAssign}><Plus className="h-3.5 w-3.5" /> Assign Usher</Button>
        </div>
        <div className="mt-3 flex items-center gap-3 text-sm">
          <ProgressBar value={zs.coverage} tone={zs.coverage >= 95 ? 'ok' : zs.coverage >= 85 ? 'gold' : 'wine'} className="flex-1" />
          <span className="tabular text-ink-500">{zs.assigned}/{zs.required}</span>
        </div>
        {zs.lead && <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-500"><Crown className="h-3.5 w-3.5 text-gold-600" /> Lead: <span className="font-medium text-ink-800">{fullName(zs.lead)}</span></p>}
        {zs.leaders.length > 0 && (
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-500">
            <Crown className="h-3.5 w-3.5 text-wine-600" />
            <span>Section leader{zs.leaders.length > 1 ? 's' : ''}:</span>
            <span className="font-medium text-ink-800">{zs.leaders.map(fullName).join(', ')}</span>
          </p>
        )}
        {zs.coordinators.length > 0 && (
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-500">
            <span>Coordinator{zs.coordinators.length > 1 ? 's' : ''}:</span>
            <span className="font-medium text-ink-800">{zs.coordinators.map(fullName).join(', ')}</span>
          </p>
        )}
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-3">
        {zs.positions.map((p) => {
          const people = list.filter((a) => a.positionId === p.id)
          return (
            <section key={p.id} className="mb-3">
              <div className="flex items-baseline justify-between px-2 pb-1 pt-2">
                <h4 className="text-[13px] font-semibold text-ink-800">{p.name}</h4>
                <span className={cn('text-xs tabular', p.required && people.length < p.required ? 'text-warn-600' : 'text-ink-400')}>{people.length}{p.required ? ` / ${p.required}` : ''}</span>
              </div>
              {people.length === 0 ? (
                <button onClick={onAssign} className="w-full rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-left text-[13px] text-ink-500 hover:border-wine-400 hover:text-wine-600">No one yet. Assign an usher</button>
              ) : (
                <ul>
                  <AnimatePresence initial={false}>
                    {people.map((a) => {
                      const m = memberMap.get(a.memberId)
                      if (!m) return null
                      return (
                        <motion.li key={a.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-paper">
                          <Avatar first={m.firstName} last={m.lastName} size="xs" />
                          <button onClick={() => onOpenMember?.(m.id)} className="min-w-0 flex-1 break-words text-left text-sm leading-snug text-ink-800 hover:text-wine-600">{fullName(m)}</button>
                          {a.isTeamLead && <Crown className="h-3.5 w-3.5 shrink-0 text-gold-600" aria-label="Team lead" />}
                          <span className="hidden text-xs text-ink-400 tabular sm:inline">{formatPhone(m.phone)}</span>
                          <button onClick={() => setConfirmId(a.id)} className="rounded p-1 text-ink-400 opacity-0 transition-opacity hover:bg-bad-50 hover:text-bad-500 focus:opacity-100 group-hover:opacity-100" aria-label={`Remove ${fullName(m)}`}><X className="h-3.5 w-3.5" /></button>
                        </motion.li>
                      )
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </section>
          )
        })}
      </div>
      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        title="Remove assignment?"
        description={removeMember ? `${fullName(removeMember)} will become unassigned for this event.` : undefined}
        confirmLabel="Remove"
        onConfirm={() => { if (confirmId) { remove(confirmId); toast.success('Assignment removed.') } }}
      />
    </div>
  )
}
