import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Crown } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useEventData } from '@/lib/selectors'
import { cn, fullName } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { MemberPicker } from './MemberPicker'
import { ZONE_KIND_PLURAL } from '@/data/venue'

interface Props {
  open: boolean
  onClose: () => void
  eventId?: string
  memberId?: string
  zoneId?: string
  /** preselect a position, e.g. an usher spot tapped on the map */
  positionId?: string
  /** quick mode: zone is fixed, dialog stays open for the next usher */
  quick?: boolean
}

export function AssignDialog({ open, onClose, eventId: evProp, memberId: mProp, zoneId: zProp, positionId: pProp, quick }: Props) {
  const activeEventId = useStore((s) => s.activeEventId)
  const events = useStore((s) => s.events)
  const members = useStore((s) => s.members)
  const assign = useStore((s) => s.assign)
  const [eventId, setEventId] = useState(evProp ?? activeEventId)
  const [memberId, setMemberId] = useState(mProp ?? '')
  const [zoneId, setZoneId] = useState(zProp ?? '')
  const [positionId, setPositionId] = useState('')
  const [lead, setLead] = useState(false)
  const [count, setCount] = useState(0)
  const data = useEventData(eventId)

  useEffect(() => {
    if (!open) return
    setEventId(evProp ?? activeEventId)
    setMemberId(mProp ?? '')
    setZoneId(zProp ?? '')
    setPositionId(pProp ?? '')
    setLead(false)
    setCount(0)
  }, [open, evProp, mProp, zProp, pProp, activeEventId])

  const positions = data.positionsByZone.get(zoneId) ?? []
  useEffect(() => {
    if (!positions.find((p) => p.id === positionId)) setPositionId(positions.find((p) => !p.isLeadRole)?.id ?? positions[0]?.id ?? '')
  }, [zoneId, positions.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLead(!!positions.find((p) => p.id === positionId)?.isLeadRole) }, [positionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const existing = memberId ? data.byMember.get(memberId) : undefined
  const sameSpot = existing && existing.positionId === positionId
  const conflict = existing && !sameSpot
  const member = members.find((m) => m.id === memberId)
  const zone = data.zoneById.get(zoneId)
  const currentLead = (data.byZone.get(zoneId) ?? []).find((a) => a.isTeamLead && a.memberId !== memberId)
  const leadMember = currentLead && members.find((m) => m.id === currentLead.memberId)
  const ready = memberId && eventId && zoneId && positionId && !sameSpot
  const spotHolder = data.positionById.get(positionId)?.spot ? data.assignments.find((a) => a.positionId === positionId && a.memberId !== memberId) : undefined
  const spotHolderMember = spotHolder && members.find((m) => m.id === spotHolder.memberId)

  const save = (again: boolean) => {
    if (!ready) return
    assign({ memberId, eventId, zoneId, positionId, isTeamLead: lead })
    const p = data.positionById.get(positionId)
    toast.success(conflict ? 'Assignment updated.' : 'Usher assigned.', `${member && fullName(member)} → ${zone?.name} · ${p?.name}`)
    if (again) { setMemberId(''); setCount((c) => c + 1) } else onClose()
  }

  const steps = [
    { label: 'Member', done: !!memberId },
    { label: 'Event', done: !!eventId },
    { label: 'Zone / Aisle', done: !!zoneId },
    { label: 'Position', done: !!positionId },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={quick && zone ? `Assign usher to ${zone.name}` : 'Assign member'}
      description={quick ? `Pick a member and a role. ${count ? `${count} assigned in this session.` : 'Use “Save & next” to keep going.'}` : 'Choose who serves where. Existing assignments for the same event are detected.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {quick && <Button variant="secondary" disabled={!ready} onClick={() => save(true)}>Save & next</Button>}
          <Button variant={conflict ? 'accent' : 'primary'} disabled={!ready} onClick={() => save(false)}>{conflict ? 'Reassign' : 'Save Assignment'}</Button>
        </>
      }
    >
      {!quick && (
        <ol className="mb-5 flex items-center gap-1.5 text-xs" aria-label="Progress">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors', s.done ? 'bg-ink-900 text-white' : 'bg-ink-900/[.06] text-ink-500')}>{i + 1}</span>
              <span className={cn('hidden sm:inline', s.done ? 'text-ink-900' : 'text-ink-500')}>{s.label}</span>
              {i < steps.length - 1 && <span className={cn('mx-1 h-px w-4 sm:w-6', s.done ? 'bg-ink-900' : 'bg-line-strong')} />}
            </li>
          ))}
        </ol>
      )}
      <div className="space-y-4 pb-2">
        <Field label="Member">
          <MemberPicker key={count} value={memberId} onChange={setMemberId} data={data} autoFocus={quick || !mProp} />
        </Field>
        {!quick && (
          <Field label="Event" htmlFor="as-ev">
            <Select id="as-ev" value={eventId} onChange={(v) => { setEventId(v); setZoneId('') }}>
              {events.filter((e) => e.status !== 'archived').map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {!quick && (
            <Field label="Zone / Aisle" htmlFor="as-z">
              <Select id="as-z" value={zoneId} onChange={setZoneId}>
                <option value="">Select a zone…</option>
                {(['aisle', 'section', 'door', 'area'] as const).map((k) => (
                  <optgroup key={k} label={ZONE_KIND_PLURAL[k]}>{data.zones.filter((z) => z.kind === k).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</optgroup>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Position" htmlFor="as-p" className={quick ? 'sm:col-span-2' : ''}>
            <Select id="as-p" value={positionId} onChange={setPositionId} disabled={!zoneId}>
              {!zoneId && <option value="">Select a zone first</option>}
              {positions.map((p) => {
                const here = data.assignments.filter((a) => a.positionId === p.id)
                if (p.spot) {
                  const who = here[0] && members.find((m) => m.id === here[0].memberId)
                  return <option key={p.id} value={p.id}>{p.name} ({who ? fullName(who) : 'open'})</option>
                }
                return <option key={p.id} value={p.id}>{p.name} ({here.length}{p.required ? `/${p.required}` : ''})</option>
              })}
            </Select>
          </Field>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3.5 py-3">
          <input type="checkbox" checked={lead} onChange={(e) => setLead(e.target.checked)} className="mt-0.5 h-4 w-4 accent-wine-600" />
          <span className="text-sm">
            <span className="flex items-center gap-1.5 font-medium text-ink-900"><Crown className="h-3.5 w-3.5 text-gold-600" /> Team lead for this zone</span>
            <span className="text-ink-500">{leadMember ? `Replaces ${fullName(leadMember)} as lead.` : 'Shown to teammates as their point of contact.'}</span>
          </span>
        </label>
        {spotHolderMember && (
          <div className="flex gap-3 rounded-xl bg-warn-50 px-4 py-3 text-sm text-warn-600 ring-1 ring-inset ring-warn-500/20">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p><strong className="font-semibold">{fullName(spotHolderMember)}</strong> stands at this spot now. Saving moves them off it, so they become unassigned.</p>
          </div>
        )}
        <AnimatePresence>
          {existing && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className={cn('flex gap-3 rounded-xl px-4 py-3 text-sm', sameSpot ? 'bg-ink-900/[.04] text-ink-700' : 'bg-warn-50 text-warn-600 ring-1 ring-inset ring-warn-500/20')}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {sameSpot ? 'This member is already in this position.' : (
                    <>This member is currently assigned to <strong className="font-semibold">{data.zoneById.get(existing.zoneId)?.name} · {data.positionById.get(existing.positionId)?.name}</strong>. Saving will reassign them.</>
                  )}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  )
}
