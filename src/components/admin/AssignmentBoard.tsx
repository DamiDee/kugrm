import type { ZoneKind } from '@/data/types'
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Crown, Maximize2, Plus } from 'lucide-react'
import type { EventData } from '@/lib/selectors'
import { useMemberMap } from '@/lib/selectors'
import { cn, fullName } from '@/lib/utils'
import { ProgressBar } from '@/components/ui/misc'

export function AssignmentBoard({ data, focusZoneId, onAssign, onOpenZone, filter }: { data: EventData; focusZoneId?: string; onAssign: (zoneId: string) => void; onOpenZone: (zoneId: string) => void; filter: 'all' | ZoneKind }) {
  const memberMap = useMemberMap()
  const refs = useRef<Record<string, HTMLElement | null>>({})
  useEffect(() => {
    if (focusZoneId) setTimeout(() => refs.current[focusZoneId]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
  }, [focusZoneId])

  const zones = data.zoneStats.filter((z) => filter === 'all' || z.zone.kind === filter)
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {zones.map((zs, i) => {
        const list = data.byZone.get(zs.zone.id) ?? []
        return (
          <motion.section
            key={zs.zone.id}
            ref={(el) => { refs.current[zs.zone.id] = el }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.025, 0.3), duration: 0.3 }}
            className={cn('group flex flex-col rounded-2xl border bg-white transition-shadow hover:shadow-lift', focusZoneId === zs.zone.id ? 'border-wine-400 shadow-ring' : 'border-line')}
            aria-labelledby={`zone-${zs.zone.id}`}
          >
            <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
              <button onClick={() => onOpenZone(zs.zone.id)} className="min-w-0 flex-1 text-left">
                <h3 id={`zone-${zs.zone.id}`} className="break-words text-[13px] font-bold uppercase tracking-[0.12em] text-ink-900 group-hover:text-wine-700">{zs.zone.name}</h3>
                <p className="mt-0.5 break-words text-xs leading-relaxed text-ink-500 tabular">
                  {zs.assigned} of {zs.required} ushers
                  {zs.lead ? ` · Lead ${fullName(zs.lead)}` : ''}
                </p>
                {(zs.leaders.length > 0 || zs.coordinators.length > 0) && (
                  <p className="mt-0.5 break-words text-[11.5px] leading-relaxed text-ink-500">
                    {zs.leaders.length > 0 && (
                      <span>Leader{zs.leaders.length > 1 ? 's' : ''}: <span className="font-medium text-ink-700">{zs.leaders.map(fullName).join(', ')}</span></span>
                    )}
                    {zs.leaders.length > 0 && zs.coordinators.length > 0 && ' · '}
                    {zs.coordinators.length > 0 && (
                      <span>Coord: <span className="font-medium text-ink-700">{zs.coordinators.map(fullName).join(', ')}</span></span>
                    )}
                  </p>
                )}
              </button>
              <button onClick={() => onOpenZone(zs.zone.id)} className="shrink-0 rounded-lg p-1.5 text-ink-400 hover:bg-paper hover:text-ink-700" aria-label={`Open ${zs.zone.name}`}><Maximize2 className="h-3.5 w-3.5" /></button>
            </header>
            <div className="px-5"><ProgressBar value={zs.coverage} tone={zs.coverage >= 95 ? 'ok' : zs.coverage >= 85 ? 'gold' : 'wine'} delay={i * 0.02} /></div>
            <dl className="flex-1 px-5 py-3">
              {zs.positions.map((p) => {
                const people = list.filter((a) => a.positionId === p.id)
                const names = people.slice(0, 2).map((a) => memberMap.get(a.memberId)).filter(Boolean)
                return (
                  <div key={p.id} className="flex items-baseline gap-3 border-b border-dashed border-line py-2 text-[13px] last:border-0">
                    <dt className="w-[42%] shrink-0 break-words text-ink-500">{p.name}</dt>
                    <dd className="flex min-w-0 flex-1 flex-wrap items-baseline text-ink-900">
                      <span className="min-w-0 break-words">
                        {names.length === 0 ? <span className="text-warn-600">Vacant</span> : names.map((m, j) => (
                          <span key={m!.id}>
                            {j > 0 && ', '}
                            {people[j].isTeamLead && <Crown className="mr-1 inline h-3 w-3 -translate-y-px text-gold-600" />}
                            {fullName(m!)}
                          </span>
                        ))}
                      </span>
                      {people.length > 2 && <span className="ml-1 shrink-0 text-ink-400">+{people.length - 2}</span>}
                    </dd>
                  </div>
                )
              })}
            </dl>
            <button onClick={() => onAssign(zs.zone.id)} className="flex items-center justify-center gap-1.5 border-t border-line py-3 text-[13px] font-medium text-wine-600 transition-colors hover:bg-wine-50/50">
              <Plus className="h-3.5 w-3.5" /> Assign Usher
            </button>
          </motion.section>
        )
      })}
    </div>
  )
}
