import { useEffect, useMemo, useState } from 'react'
import { CalendarX2, Check, Copy, Crown, KeyRound, Pencil, Phone, Plus, RefreshCw, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { leaderIdsOf, useEventData, useMemberMap, type EventData } from '@/lib/selectors'
import { LIVE, type ApiError } from '@/lib/api'
import { getFallbackKey, rotateFallbackKey } from '@/lib/live'
import type { FallbackKeyResponse } from '@/data/types'
import type { Member, ZoneKind } from '@/data/types'
import { cn, formatPhone, fullName, telHref } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState, Field, PageHeader } from '@/components/ui/misc'
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
  const [keyFor, setKeyFor] = useState<Member | null>(null)
  // offline keys: owner and admin only, and only with the backend connected
  const canKeys = useStore((s) => LIVE && s.admin?.role !== 'editor')

  const covered = new Set(coordinators.flatMap((c) => c.coordinates ?? []))
  const uncovered = data.zones.filter((z) => !covered.has(z.name))
  const groups: { leader?: Member; list: Member[] }[] = [
    ...leaders.map((l) => ({ leader: l, list: coordinators.filter((c) => leaderIdsOf(c).includes(l.id)) })),
    { leader: undefined, list: coordinators.filter((c) => !leaderIdsOf(c).some((id) => memberMap.get(id)?.role === 'leader')) },
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
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-paper px-4 py-3.5 sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                  {g.leader ? <Avatar first={g.leader.firstName} last={g.leader.lastName} size="sm" /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white ring-1 ring-line"><Crown className="h-4 w-4 text-ink-300" /></span>}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words font-semibold leading-snug text-ink-900">{g.leader ? fullName(g.leader) : 'No leader'}</span>
                      {g.leader && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-gold-700 ring-1 ring-gold-300/60">Leader</span>}
                    </div>
                    <div className="mt-0.5 break-words text-xs leading-relaxed text-ink-500">{g.list.length} coordinator{g.list.length === 1 ? '' : 's'}{g.leader && <> · <a href={telHref(g.leader.phone)} className="hover:text-wine-600 tabular">{formatPhone(g.leader.phone)}</a></>}</div>
                  </div>
                </div>
                {g.leader && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setEdit({ open: true, leaderId: g.leader!.id })}><UserPlus className="h-3.5 w-3.5" /> Coordinator</Button>
                    {canKeys && <Button size="icon-sm" variant="ghost" onClick={() => setKeyFor(g.leader!)} aria-label={`Offline key for ${fullName(g.leader)}`} title="Offline key"><KeyRound className="h-3.5 w-3.5" /></Button>}
                    <Button size="icon-sm" variant="ghost" className="hover:text-bad-500" onClick={() => setRemove(g.leader!)} aria-label={`Remove ${fullName(g.leader)} as leader`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </header>
              {g.list.length === 0 ? (
                <p className="px-4 py-4 text-sm text-ink-500">No coordinators yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {g.list.map((c) => <CoordinatorLine key={c.id} c={c} data={data} onEdit={() => setEdit({ open: true, member: c })} onRemove={() => setRemove(c)} onKey={canKeys ? () => setKeyFor(c) : undefined} />)}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <CoordinatorDialog open={edit.open} onClose={() => setEdit({ open: false })} member={edit.member} leaderId={edit.leaderId} data={data} />
      <KeyDialog member={keyFor} onClose={() => setKeyFor(null)} />
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

function CoordinatorLine({ c, data, onEdit, onRemove, onKey }: { c: Member; data: EventData; onEdit: () => void; onRemove: () => void; onKey?: () => void }) {
  const names = new Set(c.coordinates ?? [])
  const zs = data.zoneStats.filter((z) => names.has(z.zone.name))
  const assigned = zs.reduce((n, z) => n + z.assigned, 0)
  const required = zs.reduce((n, z) => n + z.required, 0)
  const ids = new Set(zs.map((z) => z.zone.id))
  const away = data.unavailable.filter((a) => ids.has(a.zoneId)).length
  return (
    <li className="flex items-start gap-3 px-4 py-3.5 sm:items-center">
      <Avatar first={c.firstName} last={c.lastName} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="break-words font-medium leading-snug text-ink-900">{fullName(c)}</span>
          <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-700 ring-1 ring-line tabular sm:hidden">{assigned}/{required}</span>
        </div>
        <div className="mt-0.5 break-words text-xs leading-relaxed text-ink-500">{zoneSummary(c.coordinates)}</div>
        {c.phone && <a href={telHref(c.phone)} className="mt-1 inline-flex items-center gap-1 text-xs text-wine-600 hover:underline tabular md:hidden"><Phone className="h-3 w-3" />{formatPhone(c.phone)}</a>}
      </div>
      <div className="hidden shrink-0 text-right text-xs sm:block">
        <div className="font-semibold text-ink-900 tabular">{assigned}/{required}</div>
        {away > 0 ? <div className="inline-flex items-center gap-1 text-bad-600"><CalendarX2 className="h-3 w-3" />{away} away</div> : <div className="text-ink-400">this session</div>}
      </div>
      <a href={telHref(c.phone)} className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-ink-700 ring-1 ring-line md:inline-flex"><Phone className="h-3.5 w-3.5 text-wine-500" />{formatPhone(c.phone)}</a>
      <div className="flex shrink-0 items-center gap-0.5">
        {onKey && <Button size="icon-sm" variant="ghost" onClick={onKey} aria-label={`Offline key for ${fullName(c)}`} title="Offline key"><KeyRound className="h-3.5 w-3.5" /></Button>}
        <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${fullName(c)}`}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button size="icon-sm" variant="ghost" className="hover:text-bad-500" onClick={onRemove} aria-label={`Remove ${fullName(c)}`}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
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
  const [leaderIds, setLeaderIds] = useState<Set<string>>(new Set())
  const [zones, setZones] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!open) return
    setId(member?.id ?? '')
    const start = member ? leaderIdsOf(member) : leaderProp ? [leaderProp] : leaders[0] ? [leaders[0].id] : []
    setLeaderIds(new Set(start))
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
    // the server replaces all links, so send the complete list
    setTeamRole(id, 'coordinator', { leaderIds: [...leaderIds], coordinates: [...zones] })
    toast.success(member ? 'Coordinator updated.' : `${m ? fullName(m) : 'Member'} is now a coordinator.`, zoneSummary([...zones]))
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} size="lg" title={member ? `Edit ${fullName(member)}` : 'Add a coordinator'} description="Pick the zones they look after. This holds for every session; their ushers change with each roster."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!id} onClick={save}>{member ? 'Save' : 'Add coordinator'}</Button></>}>
      <div className="space-y-4 pb-2">
        <div className="grid gap-4 sm:grid-cols-2">
          {!member && <Field label="Member"><MemberPicker value={id} onChange={setId} data={data} /></Field>}
          <fieldset>
            <legend className="label">Reports to</legend>
            {leaders.length === 0 ? <p className="text-sm text-ink-500">No leaders yet.</p> : (
              <div className="flex flex-wrap gap-1.5">
                {leaders.map((l) => {
                  const on = leaderIds.has(l.id)
                  return (
                    <button key={l.id} type="button" aria-pressed={on} onClick={() => setLeaderIds((s) => { const n = new Set(s); if (on) n.delete(l.id); else n.add(l.id); return n })}
                      className={cn('min-h-[34px] rounded-lg px-2.5 text-[13px] ring-1 transition-colors', on ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-ink-800 ring-line hover:ring-line-strong')}>
                      {fullName(l)}
                    </button>
                  )
                })}
              </div>
            )}
          </fieldset>
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

/**
 * View or rotate a coordinator's or leader's offline key. Nothing is fetched
 * until the admin asks, and the key is cleared as soon as the dialog closes.
 */
function KeyDialog({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const [shown, setShown] = useState<FallbackKeyResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => { setShown(null); setBusy(false); setConfirmRotate(false); setError(''); setCopied(false) }, [member])

  const explain = (e: ApiError) =>
    e.code === 'NOT_TEAM' ? 'This member is an usher. Give them a team role first.'
      : e.status === 403 ? 'Your account can’t manage offline keys. Ask an owner or admin.'
        : e.code === 'FALLBACK_KEY_ERROR' ? 'The server couldn’t read this key. Rotate it to issue a new one, or ask the backend developer.'
          : e.message
  const view = async () => {
    if (!member || busy) return
    setBusy(true); setError('')
    try { setShown(await getFallbackKey(member.id)) } catch (e) { setError(explain(e as ApiError)) } finally { setBusy(false) }
  }
  const rotate = async () => {
    if (!member || busy) return
    setBusy(true); setError(''); setConfirmRotate(false)
    try {
      setShown(await rotateFallbackKey(member.id))
      toast.success('New key issued.', 'The old key and their open sessions no longer work.')
    } catch (e) {
      // never retry a rotation: the next step is to view the current key
      setError(`${explain(e as ApiError)} If you’re not sure whether it changed, use View key rather than rotating again.`)
    } finally { setBusy(false) }
  }
  const copy = async () => {
    if (!shown) return
    try { await navigator.clipboard.writeText(shown.key); setCopied(true) } catch { setError('Couldn’t copy. Select the key and copy it by hand.') }
  }

  return (
    <Modal
      open={!!member}
      onClose={onClose}
      size="sm"
      title={member ? `Offline key for ${fullName(member)}` : ''}
      description="They sign in on the team page with their phone number and this 6-character key. Share it with them in person or by phone."
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4 pb-2">
        {shown ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-paper px-4 py-3 ring-1 ring-line">
            <div>
              <div className="select-all font-mono text-[26px] font-semibold tracking-[0.3em] text-ink-900">{shown.key}</div>
              <div className="text-xs text-ink-500">Issued {new Date(shown.rotatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => void copy()}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}</Button>
          </div>
        ) : (
          <Button variant="primary" disabled={busy} onClick={() => void view()}><KeyRound className="h-4 w-4" /> {busy ? 'Loading…' : 'View key'}</Button>
        )}
        {confirmRotate ? (
          <div className="rounded-xl bg-warn-50 px-4 py-3 text-sm text-warn-600 ring-1 ring-inset ring-warn-500/20">
            <p>Rotating stops the current key at once and signs {member?.firstName} out everywhere. They’ll need the new key.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="danger" disabled={busy} onClick={() => void rotate()}>Rotate key</Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirmRotate(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <button type="button" disabled={busy} onClick={() => setConfirmRotate(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-wine-600 hover:underline disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" /> Rotate key…</button>
        )}
        {error && <p className="text-sm text-bad-600">{error}</p>}
      </div>
    </Modal>
  )
}
