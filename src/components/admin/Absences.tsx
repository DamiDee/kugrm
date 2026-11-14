import { CalendarX2, CheckCircle2, UserPlus } from 'lucide-react'
import { absenceList, type EventData } from '@/lib/selectors'
import type { Member } from '@/data/types'
import { cn, fullName, sessionShort } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'

/**
 * Ushers who said they can't make a session. Each open place can be covered
 * from here; once someone takes it, the row shows as covered.
 */
export function Absences({ data, members, onCover, zoneNames, className, limit = 8 }: {
  data: EventData
  members: Map<string, Member>
  onCover?: (zoneId: string, positionId: string) => void
  /** limit to these zones (a coordinator's view) */
  zoneNames?: Set<string>
  className?: string
  limit?: number
}) {
  const list = absenceList(data, members).filter((x) => !zoneNames || zoneNames.has(x.zone.name))
  const open = list.filter((x) => !x.covered).length
  return (
    <section className={cn('surface', className)} aria-labelledby="abs-h">
      <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
        <div>
          <h2 id="abs-h" className="font-semibold text-ink-900">Can’t make it</h2>
          <p className="text-sm text-ink-500">
            {list.length === 0 ? `Nobody has dropped out of ${data.event ? sessionShort(data.event) : 'this session'}.` : `${open} open place${open === 1 ? '' : 's'} to cover${list.length > open ? `, ${list.length - open} covered` : ''}`}
          </p>
        </div>
        {open > 0 && <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-bad-50 px-2 text-sm font-semibold text-bad-600 ring-1 ring-bad-500/20 tabular">{open}</span>}
      </div>
      {list.length === 0 ? (
        <div className="flex items-center gap-3 px-5 pb-5 text-sm text-ink-500"><CheckCircle2 className="h-4 w-4 text-ok-500" /> Every assigned usher is still coming.</div>
      ) : (
        <ul className="px-2 pb-2">
          {list.slice(0, limit).map(({ assignment, member, zone, position, covered }) => (
            <li key={assignment.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-paper sm:items-center">
              <Avatar first={member.firstName} last={member.lastName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="break-words text-sm font-medium leading-snug text-ink-900">{fullName(member)}</div>
                <div className="mt-0.5 break-words text-xs leading-relaxed text-ink-500">{zone.name} · {position.name}{assignment.unavailableReason ? ` · ${assignment.unavailableReason}` : ''}</div>
              </div>
              {covered ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-ok-600"><CheckCircle2 className="h-3.5 w-3.5" /> Covered</span>
              ) : onCover ? (
                <Button size="sm" variant="secondary" onClick={() => onCover(zone.id, position.id)}><UserPlus className="h-3.5 w-3.5" /> Cover</Button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-bad-600"><CalendarX2 className="h-3.5 w-3.5" /> Open</span>
              )}
            </li>
          ))}
          {list.length > limit && <li className="px-3 py-2 text-xs text-ink-500">and {list.length - limit} more</li>}
        </ul>
      )}
    </section>
  )
}
