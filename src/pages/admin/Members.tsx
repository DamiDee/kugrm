import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeftRight, Crown, Filter, MapPin, Plus, SearchX, Trash2, Upload, UserMinus, Users } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useEventData } from '@/lib/selectors'
import { useFirstLoad } from '@/lib/hooks'
import { cn, formatPhone, fullName, normalizePhone } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { StatusBadge } from '@/components/ui/Badge'
import { Checkbox, EmptyState, PageHeader, SearchInput, Segmented, Select } from '@/components/ui/misc'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { BulkBar, BulkButton, Pagination, SortHeader, type SortDir } from '@/components/admin/DataTable'
import { MemberDrawer, MemberForm } from '@/components/admin/MemberDrawer'
import { BulkAssignZone, BulkChangeEvent } from '@/components/admin/BulkDialogs'

const PER = 25

export default function Members() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const members = useStore((s) => s.members)
  const events = useStore((s) => s.events)
  const activeEventId = useStore((s) => s.activeEventId)
  const removeAssignmentsFor = useStore((s) => s.removeAssignmentsFor)
  const deleteMembers = useStore((s) => s.deleteMembers)
  const [eventId, setEventId] = useState(activeEventId)
  useEffect(() => setEventId(activeEventId), [activeEventId])
  const data = useEventData(eventId)
  const loading = useFirstLoad('members')

  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'assigned' | 'unassigned'>((params.get('filter') as 'unassigned') ?? 'all')
  const [zone, setZone] = useState('')
  const [position, setPosition] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: 'name', dir: 'asc' })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<null | 'add' | 'zone' | 'event' | 'unassign' | 'delete'>(null)

  const positionNames = useMemo(() => [...new Set([...data.positionById.values()].map((p) => p.name))].sort(), [data.positionById])

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    const d = normalizePhone(q)
    const list = members
      .map((m) => {
        const a = data.byMember.get(m.id)
        return { m, a, z: a && data.zoneById.get(a.zoneId), p: a && data.positionById.get(a.positionId) }
      })
      .filter(({ m }) => !t || fullName(m).toLowerCase().includes(t) || (d.length >= 3 && m.phone.includes(d)) || m.memberId?.toLowerCase().includes(t))
      .filter(({ a, m }) => status === 'all' || (status === 'assigned' ? !!a : !a))
      .filter(({ z }) => !zone || z?.id === zone)
      .filter(({ p }) => !position || p?.name === position)
    const dir = sort.dir === 'asc' ? 1 : -1
    const key = (r: (typeof list)[number]) =>
      sort.key === 'name' ? fullName(r.m) : sort.key === 'phone' ? r.m.phone : sort.key === 'unit' ? r.m.unit ?? '' : sort.key === 'gender' ? r.m.gender ?? '' : sort.key === 'assignment' ? (r.z ? `${String(r.z.order).padStart(3, '0')}${r.p?.order}` : 'zzz') : r.m.status
    return list.sort((x, y) => key(x).localeCompare(key(y)) * dir)
  }, [members, data, q, status, zone, position, sort])

  useEffect(() => setPage(1), [q, status, zone, position, eventId])
  const pages = Math.max(1, Math.ceil(rows.length / PER))
  const pageRows = rows.slice((page - 1) * PER, page * PER)
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(r.m.id))
  const someOnPage = pageRows.some((r) => selected.has(r.m.id))
  const toggle = (mid: string) => setSelected((s) => { const n = new Set(s); n.has(mid) ? n.delete(mid) : n.add(mid); return n })
  const togglePage = () => setSelected((s) => { const n = new Set(s); pageRows.forEach((r) => (allOnPage ? n.delete(r.m.id) : n.add(r.m.id))); return n })
  const onSort = (k: string) => setSort((s) => ({ key: k, dir: s.key === k && s.dir === 'asc' ? 'desc' : 'asc' }))
  const clearFilters = () => { setQ(''); setStatus('all'); setZone(''); setPosition('') }
  const activeFilters = Number(!!zone) + Number(!!position)
  const ev = events.find((e) => e.id === eventId)
  const openMember = (mid: string) => navigate(`/admin/members/${mid}${params.toString() ? `?${params}` : ''}`)

  return (
    <div className="pb-20">
      <PageHeader
        title="Members"
        description={`${members.length.toLocaleString()} ushers in the department. Showing assignments for ${ev?.code}.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/admin/import')}><Upload className="h-4 w-4" /> Import Members</Button>
            <Button variant="primary" onClick={() => setDialog('add')}><Plus className="h-4 w-4" /> Add Member</Button>
          </>
        }
      />

      <div className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search name, phone or member ID" className="lg:w-80" />
          <Segmented id="mstatus" value={status} onChange={(v) => { setStatus(v); setParams(v === 'all' ? {} : { filter: v }, { replace: true }) }} options={[{ value: 'all', label: 'All' }, { value: 'assigned', label: 'Assigned' }, { value: 'unassigned', label: 'Unassigned' }]} />
          <div className="flex items-center gap-2 lg:ml-auto">
            <Select value={eventId} onChange={setEventId} label="Event" className="w-44">{events.filter((e) => e.status !== 'archived').map((e) => <option key={e.id} value={e.id}>{e.code}</option>)}</Select>
            <Button variant={showFilters || activeFilters ? 'subtle' : 'secondary'} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
              <Filter className="h-4 w-4" /> Filters{activeFilters > 0 && <span className="ml-0.5 rounded-full bg-wine-600 px-1.5 text-[11px] text-white">{activeFilters}</span>}
            </Button>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden border-b border-line bg-paper">
              <div className="flex flex-wrap items-end gap-3 p-4">
                <label className="w-52"><span className="label">Zone</span><Select value={zone} onChange={setZone}><option value="">All zones</option>{data.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</Select></label>
                <label className="w-52"><span className="label">Position</span><Select value={position} onChange={setPosition}><option value="">All positions</option>{positionNames.map((p) => <option key={p}>{p}</option>)}</Select></label>
                <Button variant="ghost" onClick={clearFilters}>Reset</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? <TableSkeleton /> : rows.length === 0 ? (
          members.length === 0 ? (
            <EmptyState icon={<Users className="h-5 w-5" />} title="No members yet" description="Add members one by one or import a CSV from your unit heads." action={<Button variant="primary" onClick={() => navigate('/admin/import')}><Upload className="h-4 w-4" /> Import Members</Button>} />
          ) : (
            <EmptyState icon={<SearchX className="h-5 w-5" />} title="No members match" description="Try a different name or number, or clear the filters." action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>} />
          )
        ) : (
          <>
            {/* desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-paper/60">
                  <tr>
                    <th className="w-10 py-3 pl-4"><Checkbox checked={allOnPage} indeterminate={!allOnPage && someOnPage} onChange={togglePage} label="Select page" /></th>
                    <SortHeader label="Name" k="name" sort={sort} onSort={onSort} />
                    <SortHeader label="Phone Number" k="phone" sort={sort} onSort={onSort} />
                    <SortHeader label="Gender" k="gender" sort={sort} onSort={onSort} className="hidden xl:table-cell" />
                    <SortHeader label="Team/Unit" k="unit" sort={sort} onSort={onSort} className="hidden lg:table-cell" />
                    <SortHeader label="Current Assignment" k="assignment" sort={sort} onSort={onSort} />
                    <th className="hidden px-4 py-3 text-left text-xs font-medium text-ink-500 xl:table-cell">Event</th>
                    <SortHeader label="Status" k="status" sort={sort} onSort={onSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {pageRows.map(({ m, a, z, p }) => {
                    const sel = selected.has(m.id)
                    return (
                      <tr key={m.id} onClick={() => openMember(m.id)} className={cn('cursor-pointer transition-colors', sel ? 'bg-wine-50/50' : 'hover:bg-paper')}>
                        <td className="py-3 pl-4" onClick={(e) => e.stopPropagation()}><Checkbox checked={sel} onChange={() => toggle(m.id)} label={`Select ${fullName(m)}`} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar first={m.firstName} last={m.lastName} size="sm" />
                            <div className="min-w-0"><div className="truncate font-medium text-ink-900">{fullName(m)}</div><div className="text-xs text-ink-400">{m.memberId}</div></div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-700 tabular">{formatPhone(m.phone)}</td>
                        <td className="hidden px-4 py-3 text-ink-600 xl:table-cell">{m.gender ?? '—'}</td>
                        <td className="hidden px-4 py-3 text-ink-600 lg:table-cell">{m.unit}</td>
                        <td className="px-4 py-3">{z ? <span className="flex items-center gap-1.5 text-ink-900">{a?.isTeamLead && <Crown className="h-3.5 w-3.5 text-gold-600" />}<span className="font-medium">{z.name}</span><span className="text-ink-400">·</span><span className="text-ink-600">{p?.name}</span></span> : <span className="text-ink-400">—</span>}</td>
                        <td className="hidden px-4 py-3 text-ink-600 xl:table-cell">{a ? ev?.code : '—'}</td>
                        <td className="px-4 py-3">{m.status === 'inactive' ? <StatusBadge status="inactive" /> : a ? <StatusBadge status={a.status} /> : <StatusBadge status="unassigned" />}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* mobile cards */}
            <ul className="divide-y divide-line md:hidden">
              {pageRows.map(({ m, a, z, p }) => (
                <li key={m.id} className={cn('flex items-center gap-3 px-4 py-3', selected.has(m.id) && 'bg-wine-50/50')}>
                  <Checkbox checked={selected.has(m.id)} onChange={() => toggle(m.id)} label={`Select ${fullName(m)}`} />
                  <button onClick={() => openMember(m.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <Avatar first={m.firstName} last={m.lastName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink-900">{fullName(m)}</span>
                      <span className="block truncate text-xs text-ink-500 tabular">{formatPhone(m.phone)} · {z ? `${z.name} · ${p?.name}` : 'Unassigned'}</span>
                    </span>
                    {a ? <StatusBadge status={a.status} /> : <StatusBadge status="unassigned" />}
                  </button>
                </li>
              ))}
            </ul>
            <Pagination page={page} pages={pages} total={rows.length} perPage={PER} onPage={setPage} />
          </>
        )}
      </div>

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <BulkButton onClick={() => setDialog('zone')}><MapPin className="h-3.5 w-3.5" /> Assign Zone</BulkButton>
        <BulkButton onClick={() => setDialog('event')}><ArrowLeftRight className="h-3.5 w-3.5" /> Change Event</BulkButton>
        <BulkButton onClick={() => setDialog('unassign')}><UserMinus className="h-3.5 w-3.5" /> Mark Unassigned</BulkButton>
        <BulkButton danger onClick={() => setDialog('delete')}><Trash2 className="h-3.5 w-3.5" /> Delete</BulkButton>
      </BulkBar>

      <MemberDrawer memberId={id ?? null} onClose={() => navigate(`/admin/members${params.toString() ? `?${params}` : ''}`)} />
      <MemberForm open={dialog === 'add'} onClose={() => setDialog(null)} />
      <BulkAssignZone open={dialog === 'zone'} onClose={() => setDialog(null)} memberIds={[...selected]} eventId={eventId} onDone={() => setSelected(new Set())} />
      <BulkChangeEvent open={dialog === 'event'} onClose={() => setDialog(null)} memberIds={[...selected]} fromEventId={eventId} onDone={() => setSelected(new Set())} />
      <ConfirmDialog open={dialog === 'unassign'} onClose={() => setDialog(null)} title={`Remove ${selected.size} assignments?`} description={`Selected members will become unassigned for ${ev?.code}. Their member profiles are kept.`} confirmLabel="Remove assignments" onConfirm={() => { const n = removeAssignmentsFor([...selected], eventId); toast.success(`${n} assignment${n === 1 ? '' : 's'} removed.`); setSelected(new Set()) }} />
      <ConfirmDialog open={dialog === 'delete'} onClose={() => setDialog(null)} title={`Delete ${selected.size} members?`} description="Their profiles and every assignment they hold will be permanently removed." confirmLabel="Delete members" onConfirm={() => { deleteMembers([...selected]); toast.success(`${selected.size} members deleted.`); setSelected(new Set()) }} />
    </div>
  )
}
