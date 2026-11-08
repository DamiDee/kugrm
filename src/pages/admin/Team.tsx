import { useEffect, useMemo, useState } from 'react'
import { CalendarX2, Crown, Pencil, Phone, Plus, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useEventData, useMemberMap, type EventData } from '@/lib/selectors'
import type { Member, ZoneKind } from '@/data/types'
import { cn, formatPhone, fullName, telHref } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState, Field, PageHeader, Select } from '@/components/ui/misc'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { MemberPicker } from '@/components/admin/MemberPicker'
import { zoneSummary } from '@/components/team/TeamParts'
import { ZONE_KIND_PLURAL } from '@/data/venue'

/**
 * Leaders and the section coordinators under them. A coordinator oversees a
 * set of zones (by name, so it holds for every session); both sign in on the
 * team page to see their zones and ushers.
 */
export default function Team() {
  const members = useStore((s) => s.members)
  const activeEventId = useStore((s) => s.activeEventId)
  const setTeamRole = useStore((s) => s.setTeamRole)
  const data = useEventData(activeEventId)
  const memberMap = useMemberMap()
  const leaders = members.filter((m) => m.role === 'leader')
  const coordinators = members.filter((m) => m.role === 'coordinator')
  const [edit, setEdit] = useState<{ open: boolean; member?: Member; leaderId?: string }>({ open: false })
  const [addLeader, setAddLeader] = useState(false)
  const [remove, setRemove] = useState<Member | null>(null)

  const covered = new Set(coordinators.flatMap((c) => c.coordinates ?? []))
  const uncovered = data.zones.filter((z) => !covered.has(z.name))
  const groups: { leader?: Member; list: Member[] }[] = [
    ...leaders.map((l) => ({ leader: l, list: coordinators.filter((c) => c.leaderId === l.id) })),
    { leader: undefined, list: coordinators.filter((c) => !c.leaderId || !memberMap.get(c.leaderId)) },
  ].filter((g) => g.leader || g.list.length)

  return (
    <div>
      <PageHeader
        title="Team"
        description="Leaders oversee coordinators; each coordinator looks after a set of sections, aisles or doors in every session. They sign in on the team page with their phone number."
        actions={
          <>
            <Button variant="secondary" onClick={() => setAddLeader(true)}><Crown className="h-4 w-4" /> Add leader</Button>
            <Button variant="primary" onClick={() => setEdit({ open: true })}><Plus className="h-4 w-4" /> Add coordinator</Button>
          </>
        }
      />

      {uncovered.length > 0 && (
        <div className="mb-5 rounded-2xl border border-warn-500/25 bg-warn-50 px-4 py-3 text-sm text-warn-600">
          <span className="font-semibold">{uncovered.length} zones have no coordinator:</span> {zoneSummary(uncovered.slice(0, 30).map((z) => z.name))}{uncovered.length > 30 ? ' and more' : ''}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="surface"><EmptyState icon={<ShieldCheck className="h-5 w-5" />} title="No team structure yet" description="Add a leader, then the coordinators who report to them." action={<Button variant="primary" onClick={() => setAddLeader(true)}><Crown className="h-4 w-4" /> Add leader</Button>} /></div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.leader?.id ?? 'none'} className="surface overflow-hidden">
              <header className="flex flex-wrap items-center gap-3 border-b border-line bg-paper px-4 py-3">
                {g.leader ? <Avatar first={g.leader.firstName} last={g.leader.lastName} size="sm" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-white ring-1 ring-line"><Crown className="h-4 w-4 text-ink-300" /></span>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate font-semibold text-ink-900">{g.leader ? fullName(g.leader) : 'No leader'}</span>{g.leader && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-gold-700 ring-1 ring-gold-300/60">Leader</span>}</div>
                  <div className="text-xs text-ink-500">{g.list.length} coordinator{g.list.length === 1 ? '' : 's'}{g.leader && <> · <a href={telHref(g.leader.phone)} className="hover:text-wine-600">{formatPhone(g.leader.phone)}</a></>}</div>
                </div>
                {g.leader && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setEdit({ open: true, leaderId: g.leader!.id })}><UserPlus className="h-3.5 w-3.5" /> Coordinator</Button>
                    <Button size="icon-sm" variant="ghost" className="hover:text-bad-500" onClick={() => setRemove(g.leader!)} aria-label={`Remove ${fullName(g.leader)} as leader`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </header>
              {g.list.length === 0 ? (
                <p className="px-4 py-4 text-sm text-ink-500">No coordinators yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {g.list.map((c) => <CoordinatorLine key={c.id} c={c} data={data} onEdit={() => setEdit({ open: true, member: c })} onRemove={() => setRemove(c)} />)}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <CoordinatorDialog open={edit.open} onClose={() => setEdit({ open: false })} member={edit.member} leaderId={edit.leaderId} data={data} />
      <LeaderDialog open={addLeader} onClose={() => setAddLeader(false)} data={data} />
      <ConfirmDialog
        open={!!remove}
        onClose={() => setRemove(null)}
        title={remove ? `Remove ${fullName(remove)} as ${remove.role}?` : ''}
        description={remove?.role === 'leader' ? 'Their coordinators stay, without a leader, until you move them.' : 'Their zones will have no coordinator until you give them to someone.'}
        confirmLabel="Remove"
        onConfirm={() => { if (remove) { setTeamRole(remove.id, 'usher'); toast.success(`${fullName(remove)} removed from the team structure.`) } }}
      />
    </div>
  )
}

function CoordinatorLine({ c, data, onEdit, onRemove }: { c: Member; data: EventData; onEdit: () => void; onRemove: () => void }) {
  const names = new Set(c.coordinates ?? [])
  const zs = data.zoneStats.filter((z) => names.has(z.zone.name))
  const assigned = zs.reduce((n, z) => n + z.assigned, 0)
  const required = zs.reduce((n, z) => n + z.required, 0)
  const ids = new Set(zs.map((z) => z.zone.id))
  const away = data.unavailable.filter((a) => ids.has(a.zoneId)).length
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar first={c.firstName} last={c.lastName} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-ink-900">{fullName(c)}</div>
        <div className="truncate text-xs text-ink-500">{zoneSummary(c.coordinates)}</div>
      </div>
      <div className="hidden shrink-0 text-right text-xs sm:block">
        <div className="font-semibold text-ink-900 tabular">{assigned}/{required}</div>
        {away > 0 ? <div className="inline-flex items-center gap-1 text-bad-600"><CalendarX2 className="h-3 w-3" />{away} away</div> : <div className="text-ink-400">this session</div>}
      </div>
      <a href={telHref(c.phone)} className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-ink-700 ring-1 ring-line md:inline-flex"><Phone className="h-3.5 w-3.5 text-wine-500" />{formatPhone(c.phone)}</a>
      <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${fullName(c)}`}><Pencil className="h-3.5 w-3.5" /></Button>
      <Button size="icon-sm" variant="ghost" className="hover:text-bad-500" onClick={onRemove} aria-label={`Remove ${fullName(c)}`}><Trash2 className="h-3.5 w-3.5" /></Button>
    </li>
  )
}

function LeaderDialog({ open, onClose, data }: { open: boolean; onClose: () => void; data: EventData }) {
  const setTeamRole = useStore((s) => s.setTeamRole)
  const members = useStore((s) => s.members)
  const [id, setId] = useState('')
  useEffect(() => { if (open) setId('') }, [open])
  const m = members.find((x) => x.id === id)
  return (
    <Modal open={open} onClose={onClose} size="sm" title="Add a leader" description="A leader sees every coordinator under them, their zones and their ushers."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!id} onClick={() => { setTeamRole(id, 'leader'); toast.success(`${m ? fullName(m) : 'Member'} is now a leader.`); onClose() }}>Add leader</Button></>}>
      <Field label="Member"><MemberPicker value={id} onChange={setId} data={data} /></Field>
      {m?.role === 'coordinator' && <p className="mt-3 text-sm text-warn-600">{fullName(m)} is a coordinator now; making them a leader clears their zones.</p>}
    </Modal>
  )
}

const KIND_ORDER: ZoneKind[] = ['section', 'aisle', 'door', 'area']

function CoordinatorDialog({ open, onClose, member, leaderId: leaderProp, data }: { open: boolean; onClose: () => void; member?: Member; leaderId?: string; data: EventData }) {
  const setTeamRole = useStore((s) => s.setTeamRole)
  const members = useStore((s) => s.members)
  const leaders = members.filter((m) => m.role === 'leader')
  const [id, setId] = useState('')
  const [leaderId, setLeaderId] = useState('')
  const [zones, setZones] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!open) return
    setId(member?.id ?? '')
    setLeaderId(member?.leaderId ?? leaderProp ?? leaders[0]?.id ?? '')
    setZones(new Set(member?.coordinates ?? []))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const owner = useMemo(() => {
    const m = new Map<string, Member>()
    members.filter((x) => x.role === 'coordinator' && x.id !== id).forEach((c) => c.coordinates?.forEach((z) => m.set(z, c)))
    return m
  }, [members, id])
  const byKind = KIND_ORDER.map((k) => ({ k, list: data.zones.filter((z) => z.kind === k) })).filter((g) => g.list.length)
  const toggle = (name: string) => setZones((s) => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n })
  const m = members.find((x) => x.id === id)
  const save = () => {
    setTeamRole(id, 'coordinator', { leaderId: leaderId || undefined, coordinates: [...zones] })
    toast.success(member ? 'Coordinator updated.' : `${m ? fullName(m) : 'Member'} is now a coordinator.`, zoneSummary([...zones]))
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} size="lg" title={member ? `Edit ${fullName(member)}` : 'Add a coordinator'} description="Pick the zones they look after. This holds for every session; their ushers change with each roster."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!id} onClick={save}>{member ? 'Save' : 'Add coordinator'}</Button></>}>
      <div className="space-y-4 pb-2">
        <div className="grid gap-4 sm:grid-cols-2">
          {!member && <Field label="Member"><MemberPicker value={id} onChange={setId} data={data} /></Field>}
          <Field label="Reports to" htmlFor="cd-l">
            <Select id="cd-l" value={leaderId} onChange={setLeaderId}><option value="">No leader</option>{leaders.map((l) => <option key={l.id} value={l.id}>{fullName(l)}</option>)}</Select>
          </Field>
        </div>
        {byKind.map(({ k, list }) => (
          <fieldset key={k}>
            <legend className="label">{ZONE_KIND_PLURAL[k]}</legend>
            <div className="flex flex-wrap gap-1.5">
              {list.map((z) => {
                const on = zones.has(z.name)
                const other = owner.get(z.name)
                return (
                  <button
                    key={z.id} type="button" onClick={() => toggle(z.name)} aria-pressed={on}
                    title={other ? `Now with ${fullName(other)}` : undefined}
                    className={cn('min-h-[34px] rounded-lg px-2.5 text-[13px] ring-1 transition-colors',
                      on ? 'bg-wine-600 text-white ring-wine-600' : other ? 'bg-paper text-ink-400 ring-line' : 'bg-white text-ink-800 ring-line hover:ring-line-strong')}
                  >
                    {k === 'section' ? z.name.replace('Section ', '') : z.name.replace('Door ', '')}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ))}
        <p className="text-xs text-ink-500">Greyed zones already have a coordinator. Picking one here gives it to both; you can clear it from the other person.</p>
      </div>
    </Modal>
  )
}
