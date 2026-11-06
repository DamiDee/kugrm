import { useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'
import { useEventData } from '@/lib/selectors'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'

export function BulkAssignZone({ open, onClose, memberIds, eventId, onDone }: { open: boolean; onClose: () => void; memberIds: string[]; eventId: string; onDone: () => void }) {
  const data = useEventData(eventId)
  const bulkAssign = useStore((s) => s.bulkAssign)
  const [zoneId, setZoneId] = useState('')
  const [positionId, setPositionId] = useState('')
  const positions = data.positionsByZone.get(zoneId) ?? []
  const already = memberIds.filter((id) => data.byMember.has(id)).length
  useEffect(() => { if (open) { setZoneId(''); setPositionId('') } }, [open])
  useEffect(() => { setPositionId(positions.find((p) => !p.isLeadRole)?.id ?? '') }, [zoneId]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Assign ${memberIds.length} members to a zone`}
      description="Everyone selected gets the same zone and position. Nothing is assigned at random."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!zoneId || !positionId} onClick={() => { const n = bulkAssign(memberIds, eventId, zoneId, positionId); toast.success(`${n} ushers assigned.`, `${data.zoneById.get(zoneId)?.name} · ${data.positionById.get(positionId)?.name}`); onDone(); onClose() }}>Assign {memberIds.length}</Button></>}
    >
      <div className="grid gap-4 pb-2 sm:grid-cols-2">
        <Field label="Zone / Aisle" htmlFor="bz"><Select id="bz" value={zoneId} onChange={setZoneId}><option value="">Select…</option>{data.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</Select></Field>
        <Field label="Position" htmlFor="bp"><Select id="bp" value={positionId} onChange={setPositionId} disabled={!zoneId}>{positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      </div>
      {already > 0 && <p className="mt-2 rounded-lg bg-warn-50 px-3 py-2 text-sm text-warn-600">{already} of them already have an assignment for {data.event?.code}. They will be reassigned.</p>}
    </Modal>
  )
}

export function BulkChangeEvent({ open, onClose, memberIds, fromEventId, onDone }: { open: boolean; onClose: () => void; memberIds: string[]; fromEventId: string; onDone: () => void }) {
  const events = useStore((s) => s.events)
  const moveToEvent = useStore((s) => s.moveToEvent)
  const options = events.filter((e) => e.id !== fromEventId && e.status !== 'archived' && e.status !== 'completed')
  const [to, setTo] = useState('')
  useEffect(() => { if (open) setTo(options[0]?.id ?? '') }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const from = events.find((e) => e.id === fromEventId)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Copy assignments to another event"
      description={`Selected members keep the same zone and position in the target event. Their ${from?.code} assignments are kept.`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!to} onClick={() => { const n = moveToEvent(memberIds, fromEventId, to); toast.success(`${n} assignments copied.`, n < memberIds.length ? `${memberIds.length - n} selected had no assignment to copy.` : undefined); onDone(); onClose() }}>Copy assignments</Button></>}
    >
      <Field label="Target event" htmlFor="tev" className="pb-2"><Select id="tev" value={to} onChange={setTo}>{options.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>
    </Modal>
  )
}
