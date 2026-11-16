import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Crown, Mail, Pencil, Phone, Trash2, UserMinus, UserPlus, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { memberRoleZones } from '@/lib/selectors'
import { zoneSummary } from '@/components/team/TeamParts'
import type { Member } from '@/data/types'
import { cn, formatPhone, formatShortDate, fullName, isValidPhone, normalizePhone, telHref } from '@/lib/utils'
import { Drawer, ConfirmDialog, Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { Field, Select } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { AssignDialog } from './AssignDialog'

export function MemberDrawer({ memberId, onClose }: { memberId: string | null; onClose: () => void }) {
  const members = useStore((s) => s.members)
  const member = members.find((m) => m.id === memberId)
  const assignments = useStore((s) => s.assignments)
  const events = useStore((s) => s.events)
  const zones = useStore((s) => s.zones)
  const positions = useStore((s) => s.positions)
  const activeEventId = useStore((s) => s.activeEventId)
  const removeAssignment = useStore((s) => s.removeAssignment)
  const deleteMembers = useStore((s) => s.deleteMembers)
  const [assignOpen, setAssignOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirm, setConfirm] = useState<'remove' | 'delete' | null>(null)

  const roleZones = useMemo(() => (member ? memberRoleZones(member, members) : []), [member, members])
  const isLeadership = member?.role === 'coordinator' || member?.role === 'leader'

  const history = useMemo(() => {
    if (!member) return []
    return assignments
      .filter((a) => a.memberId === member.id)
      .map((a) => ({ a, e: events.find((e) => e.id === a.eventId), z: zones.find((z) => z.id === a.zoneId), p: positions.find((p) => p.id === a.positionId) }))
      .filter((x) => x.e)
      .sort((x, y) => y.e!.date.localeCompare(x.e!.date))
  }, [member, assignments, events, zones, positions])

  const current = history.find((h) => h.e!.id === activeEventId)
  const activeEvent = events.find((e) => e.id === activeEventId)

  return (
    <Drawer open={!!member} onClose={onClose} label="Member profile">
      {member && (
        <>
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <span className="eyebrow">Member profile</span>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            <div className="px-6 pb-6 pt-6">
              <div className="flex items-start gap-4">
                <Avatar first={member.firstName} last={member.lastName} size="xl" />
                <div className="min-w-0 flex-1 pt-1">
                  <h2 className="text-xl font-semibold tracking-tight text-ink-900">{fullName(member)}</h2>
                  <p className="mt-0.5 text-sm text-ink-500">{member.memberId} · {member.unit}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={member.status} />
                    {isLeadership && (
                      <span className={cn(
                        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset',
                        member.role === 'leader' ? 'bg-gold-100 text-gold-700 ring-gold-300/60' : 'bg-wine-50 text-wine-700 ring-wine-200/80',
                      )}>
                        <Crown className="h-3.5 w-3.5 shrink-0" />
                        {member.role === 'leader' ? 'Leader' : 'Section Coordinator'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <a href={telHref(member.phone)} className="inline-flex h-9 items-center gap-2 rounded-full border border-line px-3.5 text-sm text-ink-800 hover:border-line-strong"><Phone className="h-3.5 w-3.5 text-wine-500" /><span className="tabular">{formatPhone(member.phone)}</span></a>
                {member.email && <a href={`mailto:${member.email}`} className="inline-flex h-9 max-w-full items-center gap-2 rounded-full border border-line px-3.5 text-sm text-ink-800 hover:border-line-strong"><Mail className="h-3.5 w-3.5 text-wine-500" /><span className="truncate">{member.email}</span></a>}
              </div>
            </div>

            <section className="mx-6 rounded-2xl border border-line">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <span className="text-sm font-semibold text-ink-900">{activeEvent?.code ?? 'Current event'}</span>
                {current ? <StatusBadge status={current.a.status} /> : isLeadership ? <StatusBadge status="assigned" /> : <StatusBadge status="unassigned" />}
              </div>
              {current ? (
                <div className="px-4 py-4">
                  <div className="text-[22px] font-light uppercase tracking-[-0.01em] text-ink-900">{current.z?.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-sm text-ink-600">{current.p?.name}{current.a.isTeamLead && <span className="inline-flex items-center gap-1 text-gold-700"><Crown className="h-3.5 w-3.5" /> Lead</span>}</div>
                  {isLeadership && roleZones.length > 0 && (
                    <div className="mt-3 rounded-xl bg-paper px-3 py-2.5 text-xs text-ink-700 ring-1 ring-line">
                      <div className="flex items-center gap-1.5 font-semibold text-ink-900">
                        <Crown className="h-3.5 w-3.5 text-gold-600" />
                        <span>{member.role === 'leader' ? 'Leader overseeing:' : 'Coordinator overseeing:'}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {roleZones.map((zn) => (
                          <span key={zn} className="rounded-lg bg-white px-2 py-0.5 font-medium text-ink-800 ring-1 ring-line">{zn}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setAssignOpen(true)}><ArrowLeftRight className="h-3.5 w-3.5" /> Change Assignment</Button>
                    <Button size="sm" variant="ghost" className="text-bad-500 hover:bg-bad-50" onClick={() => setConfirm('remove')}><UserMinus className="h-3.5 w-3.5" /> Remove</Button>
                  </div>
                </div>
              ) : isLeadership ? (
                <div className="px-4 py-4">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-gold-100/80 px-2.5 py-1 text-xs font-semibold text-gold-700 ring-1 ring-gold-300/60">
                    <Crown className="h-3.5 w-3.5 shrink-0" />
                    <span>{member.role === 'leader' ? 'Leader' : 'Section Coordinator'}</span>
                  </div>
                  <div className="mt-2 text-base font-semibold text-ink-900">{zoneSummary(roleZones)}</div>
                  {roleZones.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {roleZones.map((zn) => (
                        <span key={zn} className="rounded-lg bg-paper px-2.5 py-1 text-xs font-medium text-ink-800 ring-1 ring-line">{zn}</span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setAssignOpen(true)}><UserPlus className="h-3.5 w-3.5" /> Also assign seat position</Button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-4">
                  <p className="text-sm text-ink-500">Not assigned to a working position for this event.</p>
                  <Button size="sm" variant="primary" className="mt-3" onClick={() => setAssignOpen(true)}><UserPlus className="h-3.5 w-3.5" /> Assign Position</Button>
                </div>
              )}
            </section>

            <section className="px-6 py-6">
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-ink-900">Assignment history</h3>
                <span className="text-xs text-ink-500">{history.length} event{history.length === 1 ? '' : 's'} served</span>
              </div>
              {history.length === 0 ? (
                <p className="rounded-xl bg-paper px-4 py-5 text-center text-sm text-ink-500">No assignments yet.</p>
              ) : (
                <ol className="relative ml-1.5 border-l border-line">
                  {history.map(({ a, e, z, p }) => (
                    <li key={a.id} className="relative pb-4 pl-5 last:pb-0">
                      <span className={cn('absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white', e!.id === activeEventId ? 'bg-wine-500' : 'bg-ink-300')} />
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-ink-900">{e!.code}</span>
                        <span className="text-xs text-ink-400">{formatShortDate(e!.date)}</span>
                      </div>
                      <div className="text-[13px] text-ink-500">{z?.name} · {p?.name}{e!.rosterStatus === 'draft' && ' · draft roster'}</div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <dl className="mx-6 mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm">
              {[['Gender', member.gender ?? '—'], ['Unit', member.unit ?? '—'], ['Member since', member.joinedYear ?? '—'], ['Member ID', member.memberId ?? '—']].map(([k, v]) => (
                <div key={k} className="bg-white px-4 py-3"><dt className="text-xs text-ink-500">{k}</dt><dd className="mt-0.5 font-medium text-ink-900">{v}</dd></div>
              ))}
            </dl>
          </div>
          <div className="flex gap-2 border-t border-line bg-paper px-5 py-3">
            <Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit</Button>
            <Button variant="ghost" className="ml-auto text-bad-500 hover:bg-bad-50" onClick={() => setConfirm('delete')}><Trash2 className="h-4 w-4" /> Delete member</Button>
          </div>

          <AssignDialog open={assignOpen} onClose={() => setAssignOpen(false)} memberId={member.id} />
          <MemberForm open={editOpen} onClose={() => setEditOpen(false)} member={member} />
          <ConfirmDialog open={confirm === 'remove'} onClose={() => setConfirm(null)} title="Remove assignment?" description={`${fullName(member)} will become unassigned for ${activeEvent?.code}.`} confirmLabel="Remove assignment" onConfirm={() => { current && removeAssignment(current.a.id); toast.success('Assignment removed.') }} />
          <ConfirmDialog open={confirm === 'delete'} onClose={() => setConfirm(null)} title="Delete member?" description={`${fullName(member)} and all of their assignments will be permanently removed.`} confirmLabel="Delete member" onConfirm={() => { deleteMembers([member.id]); onClose(); toast.success('Member deleted.') }} />
        </>
      )}
    </Drawer>
  )
}

export function MemberForm({ open, onClose, member }: { open: boolean; onClose: () => void; member?: Member }) {
  const addMember = useStore((s) => s.addMember)
  const updateMember = useStore((s) => s.updateMember)
  const members = useStore((s) => s.members)
  const blank = { firstName: '', lastName: '', phone: '', email: '', gender: '' as Member['gender'] | '', unit: 'Team A', status: 'active' as Member['status'] }
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    if (open) { setF(member ? { ...blank, ...member, email: member.email ?? '', gender: member.gender ?? '', phone: formatPhone(member.phone) } : blank); setErrors({}) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    const e: Record<string, string> = {}
    if (!f.firstName.trim()) e.firstName = 'Required'
    if (!f.lastName.trim()) e.lastName = 'Required'
    const phone = normalizePhone(f.phone)
    if (!isValidPhone(phone)) e.phone = 'Enter a Nigerian number, or include the country code, e.g. +44 7911 123456'
    else if (members.some((m) => m.phone === phone && m.id !== member?.id)) e.phone = 'Another member already uses this number'
    setErrors(e)
    if (Object.keys(e).length) return
    const payload = { firstName: f.firstName.trim(), lastName: f.lastName.trim(), phone, email: f.email || undefined, gender: (f.gender || undefined) as Member['gender'], unit: f.unit, status: f.status }
    if (member) { updateMember(member.id, payload); toast.success('Member updated.') }
    else { addMember({ ...payload, memberId: `KGU-${1001 + members.length}`, joinedYear: new Date().getFullYear() }); toast.success('Member created successfully.') }
    onClose()
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }))
  return (
    <Modal open={open} onClose={onClose} title={member ? 'Edit member' : 'Add member'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{member ? 'Save changes' : 'Add member'}</Button></>}>
      <div className="grid gap-4 pb-2 sm:grid-cols-2">
        <Field label="First name" htmlFor="mf-f" error={errors.firstName}><input id="mf-f" className="field" value={f.firstName} onChange={set('firstName')} /></Field>
        <Field label="Last name" htmlFor="mf-l" error={errors.lastName}><input id="mf-l" className="field" value={f.lastName} onChange={set('lastName')} /></Field>
        <Field label="Phone number" htmlFor="mf-p" error={errors.phone} hint="Used by the usher to find their roster"><input id="mf-p" inputMode="tel" className="field tabular" placeholder="0801 234 5678" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Email (optional)" htmlFor="mf-e"><input id="mf-e" type="email" className="field" value={f.email} onChange={set('email')} /></Field>
        <Field label="Gender" htmlFor="mf-g"><Select id="mf-g" value={f.gender ?? ''} onChange={(v) => setF((s) => ({ ...s, gender: v as Member['gender'] }))}><option value="">Not specified</option><option>Male</option><option>Female</option></Select></Field>
        <Field label="Team / Unit" htmlFor="mf-u"><Select id="mf-u" value={f.unit} onChange={(v) => setF((s) => ({ ...s, unit: v }))}>{['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F'].map((u) => <option key={u}>{u}</option>)}</Select></Field>
        <Field label="Status" htmlFor="mf-s"><Select id="mf-s" value={f.status} onChange={(v) => setF((s) => ({ ...s, status: v as Member['status'] }))}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
      </div>
    </Modal>
  )
}
