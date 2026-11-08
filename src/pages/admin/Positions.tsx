import { useEffect, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { Check, Crown, GripVertical, ListTree, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useEventData } from '@/lib/selectors'
import type { Position, Zone, ZoneKind } from '@/data/types'
import { ZONE_KIND_LABEL } from '@/data/venue'
import { DUTIES, DUTY_LABEL, dutyOf } from '@/data/duties'
import type { Duty } from '@/data/types'
import { Button } from '@/components/ui/Button'
import { EmptyState, Field, PageHeader, Popover, Segmented, Select } from '@/components/ui/misc'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'

export default function Positions() {
  const activeEventId = useStore((s) => s.activeEventId)
  const data = useEventData(activeEventId)
  const addZone = useStore((s) => s.addZone)
  const [filter, setFilter] = useState<'all' | ZoneKind>('all')
  const [addOpen, setAddOpen] = useState(false)
  const zones = data.zones.filter((z) => filter === 'all' || z.kind === filter)

  return (
    <div>
      <PageHeader
        title="Positions"
        description={`The working structure for ${data.event?.code}: ${data.stats.zones} zones and ${data.stats.positions} positions. New events copy this structure.`}
        actions={<Button variant="primary" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add zone</Button>}
      />
      <div className="mb-5"><div className="-mx-1 overflow-x-auto px-1"><Segmented id="pfilter" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'aisle', label: 'Aisles' }, { value: 'section', label: 'Sections' }, { value: 'door', label: 'Doors' }, { value: 'area', label: 'Areas' }]} /></div></div>
      {zones.length === 0 ? (
        <div className="surface"><EmptyState icon={<ListTree className="h-5 w-5" />} title="No positions yet" description="Add an aisle or area, then the positions ushers will fill inside it." action={<Button variant="primary" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add zone</Button>} /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {zones.map((z) => <PositionGroup key={z.id} zone={z} positions={data.positionsByZone.get(z.id) ?? []} counts={data.byZone.get(z.id)?.length ?? 0} />)}
        </div>
      )}
      <AddZone open={addOpen} onClose={() => setAddOpen(false)} onSave={(name, kind) => { addZone(activeEventId, name, kind); toast.success(`${name} added.`, 'Add positions to it next.') }} />
    </div>
  )
}

function AddZone({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (name: string, kind: ZoneKind) => void }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ZoneKind>('aisle')
  useEffect(() => { if (open) { setName(''); setKind('aisle') } }, [open])
  return (
    <Modal open={open} onClose={onClose} size="sm" title="Add zone" description="Name it like the floor plan (Aisle 2, Section 14, Door D4) and it appears on the venue map. Other areas are listed beside it." footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!name.trim()} onClick={() => { onSave(name.trim(), kind); onClose() }}>Add zone</Button></>}>
      <div className="space-y-4 pb-2">
        <Field label="Type" htmlFor="zk"><Select id="zk" value={kind} onChange={(v) => setKind(v as ZoneKind)}><option value="aisle">Aisle</option><option value="section">Section</option><option value="door">Door</option><option value="area">Area (altar, car park, overflow…)</option></Select></Field>
        <Field label="Name" htmlFor="zn"><input id="zn" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={{ aisle: 'Aisle 6', section: 'Section 14', door: 'Door D4', area: 'Overflow' }[kind]} onKeyDown={(e) => e.key === 'Enter' && name.trim() && (onSave(name.trim(), kind), onClose())} /></Field>
      </div>
    </Modal>
  )
}

function PositionGroup({ zone, positions, counts }: { zone: Zone; positions: Position[]; counts: number }) {
  const renameZone = useStore((s) => s.renameZone)
  const deleteZone = useStore((s) => s.deleteZone)
  const addPosition = useStore((s) => s.addPosition)
  const reorder = useStore((s) => s.reorderPositions)
  const [items, setItems] = useState(positions.map((p) => p.id))
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(zone.name)
  const [newPos, setNewPos] = useState('')
  const [confirm, setConfirm] = useState(false)
  useEffect(() => setItems(positions.map((p) => p.id)), [positions])
  const byId = new Map(positions.map((p) => [p.id, p]))
  const required = positions.reduce((n, p) => n + (p.required ?? 0), 0)
  const saveName = () => { if (name.trim()) { renameZone(zone.id, name.trim()); setEditing(false); toast.success('Zone renamed.') } }
  const addNew = () => { if (newPos.trim()) { addPosition(zone.id, newPos.trim()); setNewPos('') } }

  return (
    <section className="flex flex-col rounded-2xl border border-line bg-white">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        {editing ? (
          <div className="flex flex-1 items-center gap-1" onKeyDown={(e) => e.key === 'Enter' && saveName()}>
            <input autoFocus className="field h-8" value={name} onChange={(e) => setName(e.target.value)} aria-label="Zone name" />
            <Button size="icon-sm" variant="ghost" onClick={saveName} aria-label="Save"><Check className="h-4 w-4" /></Button>
            <Button size="icon-sm" variant="ghost" onClick={() => { setEditing(false); setName(zone.name) }} aria-label="Cancel"><X className="h-4 w-4" /></Button>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[13px] font-bold uppercase tracking-[0.12em] text-ink-900">{zone.name}</h3>
              <p className="text-xs text-ink-500">{ZONE_KIND_LABEL[zone.kind]} · {positions.length} positions · needs {required}</p>
            </div>
            <Popover className="w-40 p-1" trigger={({ toggle }) => <Button size="icon-sm" variant="ghost" onClick={toggle} aria-label={`${zone.name} options`}><MoreHorizontal className="h-4 w-4" /></Button>}>
              {(close) => (
                <div className="text-sm">
                  <button onClick={() => { close(); setEditing(true) }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-paper"><Pencil className="h-4 w-4 text-ink-400" />Rename</button>
                  <button onClick={() => { close(); setConfirm(true) }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-bad-500 hover:bg-bad-50"><Trash2 className="h-4 w-4" />Delete zone</button>
                </div>
              )}
            </Popover>
          </>
        )}
      </header>
      <Reorder.Group axis="y" values={items} onReorder={setItems} className="flex-1 p-2">
        {items.map((pid) => byId.get(pid) && <PositionRow key={pid} position={byId.get(pid)!} onDrop={() => reorder(zone.id, items)} />)}
      </Reorder.Group>
      <div className="flex gap-2 border-t border-line p-3" onKeyDown={(e) => e.key === 'Enter' && addNew()}>
        <input className="field h-9" placeholder="Add a position, e.g. Greeter" value={newPos} onChange={(e) => setNewPos(e.target.value)} aria-label={`New position in ${zone.name}`} />
        <Button size="sm" variant="secondary" className="h-9" disabled={!newPos.trim()} onClick={addNew}><Plus className="h-3.5 w-3.5" /> Add</Button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={`Delete ${zone.name}?`} description={`Its ${positions.length} positions and ${counts} assignments will be removed. Those ushers become unassigned.`} confirmLabel="Delete zone" onConfirm={() => { deleteZone(zone.id); toast.success(`${zone.name} deleted.`) }} />
    </section>
  )
}

function PositionRow({ position, onDrop }: { position: Position; onDrop: () => void }) {
  const controls = useDragControls()
  const update = useStore((s) => s.updatePosition)
  const del = useStore((s) => s.deletePosition)
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(position.name)
  const [req, setReq] = useState(String(position.required ?? ''))
  const [duty, setDuty] = useState<Duty>(dutyOf(position))
  const [confirm, setConfirm] = useState(false)
  const savePos = () => { update(position.id, { name: name.trim() || position.name, required: Number(req) || 0, duty }); setEdit(false) }
  return (
    <Reorder.Item value={position.id} dragListener={false} dragControls={controls} onDragEnd={onDrop} className="group relative flex items-center gap-2 rounded-lg bg-white px-1.5 py-1.5 hover:bg-paper" whileDrag={{ scale: 1.02, boxShadow: '0 12px 32px -8px rgba(17,24,39,.18)' }}>
      <button onPointerDown={(e) => controls.start(e)} className="cursor-grab touch-none rounded p-1 text-ink-300 hover:text-ink-600 active:cursor-grabbing" aria-label={`Drag to reorder ${position.name}`}><GripVertical className="h-4 w-4" /></button>
      {edit ? (
        <div className="flex flex-1 items-center gap-1.5" onKeyDown={(e) => e.key === 'Enter' && savePos()}>
          <input autoFocus className="field h-8 flex-1" value={name} onChange={(e) => setName(e.target.value)} aria-label="Position name" />
          <select className="field h-8 w-28 px-2 text-xs" value={duty} onChange={(e) => setDuty(e.target.value as Duty)} aria-label="Duty" disabled={!!position.spot}>
            {DUTIES.map((d) => <option key={d} value={d}>{DUTY_LABEL[d]}</option>)}
          </select>
          <input className="field h-8 w-16 tabular" inputMode="numeric" value={req} onChange={(e) => setReq(e.target.value.replace(/\D/g, ''))} aria-label="Ushers needed" title="Ushers needed" />
          <Button size="icon-sm" variant="ghost" onClick={savePos} aria-label="Save"><Check className="h-4 w-4" /></Button>
        </div>
      ) : (
        <>
          <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-ink-800">{position.isLeadRole && <Crown className="h-3.5 w-3.5 text-gold-600" />}<span className="truncate">{position.name}</span></span>
          <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 text-[11px] text-ink-500 ring-1 ring-line">{DUTY_LABEL[dutyOf(position)]}</span>
          <span className="text-xs text-ink-400 tabular" title="Ushers needed">{position.required ?? 0}</span>
          <div className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <Button size="icon-sm" variant="ghost" onClick={() => setEdit(true)} aria-label={`Edit ${position.name}`}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="icon-sm" variant="ghost" className="hover:text-bad-500" onClick={() => setConfirm(true)} aria-label={`Delete ${position.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </>
      )}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={`Delete ${position.name}?`} description="Ushers in this position will become unassigned." confirmLabel="Delete position" onConfirm={() => { del(position.id); toast.success('Position deleted.') }} />
    </Reorder.Item>
  )
}
