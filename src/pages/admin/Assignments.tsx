import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardList, Crown, LayoutGrid, Map as MapIcon, Pencil, Plus, Rows3, SearchX, Trash2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { positionsOf, spotOccupants, uncoveredSpots, useEventData, useMemberMap } from '@/lib/selectors'
import { DUTIES, DUTY_LABEL, dutyOf } from '@/data/duties'
import { useFirstLoad, useMediaQuery } from '@/lib/hooks'
import type { ZoneKind } from '@/data/types'
import { cn, eventLabel, formatPhone, fullName, normalizePhone } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState, PageHeader, SearchInput, Segmented, Select } from '@/components/ui/misc'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { BottomSheet, ConfirmDialog, Drawer } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { Pagination, SortHeader, type SortDir } from '@/components/admin/DataTable'
import { AssignDialog } from '@/components/admin/AssignDialog'
import { AssignmentBoard } from '@/components/admin/AssignmentBoard'
import { ZonePanel } from '@/components/admin/ZonePanel'
import { VenueMap } from '@/components/venue/VenueMap'

type View = 'table' | 'board' | 'map'
const PER = 30

export default function Assignments() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const view = (params.get('view') as View) || 'table'
  const zoneParam = params.get('zone') ?? ''
  const activeEventId = useStore((s) => s.activeEventId)
  const data = useEventData(activeEventId)
  const memberMap = useMemberMap()
  const occupants = useMemo(() => spotOccupants(data, memberMap), [data, memberMap])
  const mapPositions = useMemo(() => positionsOf(data), [data])
  const uncovered = useMemo(() => uncoveredSpots(data, memberMap), [data, memberMap])
  const remove = useStore((s) => s.removeAssignment)
  const loading = useFirstLoad('assignments')

  const [assign, setAssign] = useState<{ open: boolean; zoneId?: string; positionId?: string; memberId?: string; quick?: boolean }>({ open: false })
  const [panelZone, setPanelZone] = useState<string | null>(null)
  const [mapZone, setMapZone] = useState<string>(zoneParam)
  const wide = useMediaQuery('(min-width: 1280px)')
  const [boardFilter, setBoardFilter] = useState<'all' | ZoneKind>('all')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const setView = (v: View) => setParams({ view: v }, { replace: true })
  useEffect(() => { if (zoneParam) setMapZone(zoneParam) }, [zoneParam])

  // table state
  const [q, setQ] = useState('')
  const [zone, setZone] = useState('')
  const [status, setStatus] = useState('')
  const [duty, setDuty] = useState(params.get('duty') ?? '')
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: 'zone', dir: 'asc' })
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [q, zone, status, duty, activeEventId])

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    const d = normalizePhone(q)
    const leadByZone = new Map(data.zoneStats.map((z) => [z.zone.id, z.lead ?? z.leaders[0] ?? z.coordinators[0]]))
    const list = [...data.assignments, ...data.unavailable]
      .map((a) => ({ a, m: memberMap.get(a.memberId)!, z: data.zoneById.get(a.zoneId)!, p: data.positionById.get(a.positionId)!, lead: leadByZone.get(a.zoneId) }))
      .filter((r) => r.m && r.z && r.p)
      .filter((r) => !t || fullName(r.m).toLowerCase().includes(t) || (d.length >= 3 && r.m.phone.includes(d)))
      .filter((r) => !zone || r.z.id === zone)
      .filter((r) => (status ? r.a.status === status : r.a.status !== 'unavailable'))
      .filter((r) => !duty || dutyOf(r.p) === duty)
    const dir = sort.dir === 'asc' ? 1 : -1
    const key = (r: (typeof list)[number]) => sort.key === 'member' ? fullName(r.m) : sort.key === 'position' ? r.p.name : sort.key === 'status' ? r.a.status : `${String(r.z.order).padStart(3, '0')}${r.p.order}${fullName(r.m)}`
    return list.sort((x, y) => key(x).localeCompare(key(y)) * dir)
  }, [data, memberMap, q, zone, status, duty, sort])
  const pages = Math.max(1, Math.ceil(rows.length / PER))
  const pageRows = rows.slice((page - 1) * PER, page * PER)
  const onSort = (k: string) => setSort((s) => ({ key: k, dir: s.key === k && s.dir === 'asc' ? 'desc' : 'asc' }))
  const toRemove = confirmId ? [...data.assignments, ...data.unavailable].find((a) => a.id === confirmId) : undefined

  const info = Object.fromEntries(data.zoneStats.map((z) => [z.zone.id, { assigned: z.assigned, required: z.required, coverage: z.coverage, leaders: z.leaders.map(fullName), coordinators: z.coordinators.map(fullName) }]))

  return (
    <div>
      <PageHeader
        title="Assignments"
        description={`${data.stats.assigned.toLocaleString()} ushers assigned across ${data.stats.zones} zones for ${data.event ? eventLabel(data.event) : ''}.`}
        actions={
          <>
            <Segmented id="aview" value={view} onChange={setView} options={[
              { value: 'table', label: 'Table', icon: <Rows3 className="h-3.5 w-3.5" /> },
              { value: 'board', label: 'Assignment Board', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
              { value: 'map', label: 'Venue Map', icon: <MapIcon className="h-3.5 w-3.5" /> },
            ]} />
            <Button variant="primary" onClick={() => setAssign({ open: true })}><Plus className="h-4 w-4" /> Assign member</Button>
          </>
        }
      />

      {data.zones.length === 0 ? (
        <div className="surface"><EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No positions configured" description="Set up aisles, zones and positions for this event before assigning ushers." action={<Button variant="primary" onClick={() => navigate('/admin/positions')}>Configure positions</Button>} /></div>
      ) : view === 'board' ? (
        <>
          <div className="mb-4 flex items-center justify-between">
            <Segmented id="bfilter" size="sm" value={boardFilter} onChange={setBoardFilter} options={[{ value: 'all', label: 'All' }, { value: 'aisle', label: 'Aisles' }, { value: 'section', label: 'Sections' }, { value: 'door', label: 'Doors' }, { value: 'area', label: 'Areas' }]} />
            <span className="hidden text-xs text-ink-500 sm:inline">Click a zone to see everyone in it</span>
          </div>
          <AssignmentBoard data={data} filter={boardFilter} focusZoneId={zoneParam} onAssign={(z) => setAssign({ open: true, zoneId: z, quick: true })} onOpenZone={setPanelZone} />
        </>
      ) : view === 'map' ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <div className="surface p-4 sm:p-5">
            <VenueMap
              zones={data.zones} mode="coverage" info={info} selectedZoneId={mapZone} onSelect={setMapZone}
              positions={mapPositions} occupants={occupants} uncovered={uncovered}
              onSelectSpot={(zoneId, positionId) => (occupants[positionId] ? setMapZone(zoneId) : setAssign({ open: true, zoneId, positionId }))}
            />
          </div>
          <div className="surface hidden min-h-[420px] overflow-hidden xl:sticky xl:block xl:top-24 xl:max-h-[calc(100dvh-8rem)]">
            {wide && mapZone && data.zoneById.get(mapZone) ? (
              <ZonePanel zoneId={mapZone} data={data} onAssign={() => setAssign({ open: true, zoneId: mapZone, quick: true })} onOpenMember={(id) => navigate(`/admin/members/${id}`)} />
            ) : (
              <EmptyState icon={<MapIcon className="h-5 w-5" />} title="Select a zone" description="Tap any section, aisle or door on the map to see and edit who is serving there." />
            )}
          </div>
          {!wide && (
            <BottomSheet open={!!mapZone && !!data.zoneById.get(mapZone)} onClose={() => setMapZone('')} label="Zone details">
              {mapZone && <ZonePanel zoneId={mapZone} data={data} onAssign={() => setAssign({ open: true, zoneId: mapZone, quick: true })} onOpenMember={(id) => navigate(`/admin/members/${id}`)} />}
            </BottomSheet>
          )}
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center">
            <SearchInput value={q} onChange={setQ} placeholder="Search member or phone" className="md:w-72" />
            <Select value={zone} onChange={setZone} label="Zone" className="md:w-48"><option value="">All zones</option>{data.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</Select>
            <Select value={status} onChange={setStatus} label="Status" className="md:w-40"><option value="">Any status</option><option value="assigned">Assigned</option><option value="confirmed">Confirmed</option><option value="unavailable">Can’t make it</option></Select>
            <Select value={duty} onChange={setDuty} label="Duty" className="md:w-44"><option value="">Any duty</option>{DUTIES.map((d) => <option key={d} value={d}>{DUTY_LABEL[d]}</option>)}</Select>
          </div>
          {loading ? <TableSkeleton /> : rows.length === 0 ? (
            data.assignments.length === 0
              ? <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No assignments yet" description="Assign ushers one by one, from the board, or in bulk from Members." action={<Button variant="primary" onClick={() => setAssign({ open: true })}><Plus className="h-4 w-4" /> Assign member</Button>} />
              : <EmptyState icon={<SearchX className="h-5 w-5" />} title="No assignments match" description="Try another name or clear the filters." action={<Button variant="secondary" onClick={() => { setQ(''); setZone(''); setStatus(''); setDuty('') }}>Clear filters</Button>} />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="border-b border-line bg-paper/60">
                    <tr>
                      <SortHeader label="Member" k="member" sort={sort} onSort={onSort} className="pl-5" />
                      <th className="px-4 py-3 text-left text-xs font-medium text-ink-500">Phone</th>
                      <th className="hidden px-4 py-3 text-left text-xs font-medium text-ink-500 xl:table-cell">Duty</th>
                      <SortHeader label="Zone/Aisle" k="zone" sort={sort} onSort={onSort} />
                      <SortHeader label="Position" k="position" sort={sort} onSort={onSort} />
                      <th className="hidden px-4 py-3 text-left text-xs font-medium text-ink-500 lg:table-cell">Team Lead</th>
                      <SortHeader label="Status" k="status" sort={sort} onSort={onSort} />
                      <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {pageRows.map(({ a, m, z, p, lead }) => (
                      <tr key={a.id} className="group hover:bg-paper">
                        <td className="py-2.5 pl-5 pr-4">
                          <button onClick={() => navigate(`/admin/members/${m.id}`)} className="flex items-center gap-3 text-left">
                            <Avatar first={m.firstName} last={m.lastName} size="sm" />
                            <span className="font-medium text-ink-900 hover:text-wine-600">{fullName(m)}</span>
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-ink-600 tabular">{formatPhone(m.phone)}</td>
                        <td className="hidden px-4 py-2.5 text-ink-600 xl:table-cell">{DUTY_LABEL[dutyOf(p)]}</td>
                        <td className="px-4 py-2.5 font-medium text-ink-900">{z.name}</td>
                        <td className="px-4 py-2.5 text-ink-700">{p.name}</td>
                        <td className="hidden px-4 py-2.5 lg:table-cell">{a.isTeamLead ? <span className="inline-flex items-center gap-1 text-gold-700"><Crown className="h-3.5 w-3.5" /> Lead</span> : <span className="text-ink-500">{lead ? fullName(lead) : '—'}</span>}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={a.status} />{a.status === 'unavailable' && a.unavailableReason && <div className="mt-1 max-w-[180px] truncate text-xs text-ink-500">{a.unavailableReason}</div>}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                            <Button size="icon-sm" variant="ghost" onClick={() => setAssign({ open: true, memberId: m.id })} aria-label={`Edit ${fullName(m)}’s assignment`}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon-sm" variant="ghost" className="hover:bg-bad-50 hover:text-bad-500" onClick={() => setConfirmId(a.id)} aria-label={`Remove ${fullName(m)}’s assignment`}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-line md:hidden">
                {pageRows.map(({ a, m, z, p, lead }) => (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-3.5">
                    <Avatar first={m.firstName} last={m.lastName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="break-words font-medium leading-snug text-ink-900">{fullName(m)}</div>
                      <div className="mt-0.5 break-words text-xs leading-relaxed text-ink-500">
                        {z.name} · {p.name}
                        {lead && ` · Lead: ${fullName(lead)}`}
                        {a.status === 'unavailable' && <span className="text-bad-600"> · can’t make it</span>}
                      </div>
                    </div>
                    <Button size="icon-sm" variant="ghost" onClick={() => setAssign({ open: true, memberId: m.id })} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                  </li>
                ))}
              </ul>
              <Pagination page={page} pages={pages} total={rows.length} perPage={PER} onPage={setPage} />
            </>
          )}
        </div>
      )}

      <Drawer open={!!panelZone} onClose={() => setPanelZone(null)} label="Zone details" width="max-w-lg">
        {panelZone && <ZonePanel zoneId={panelZone} data={data} onAssign={() => setAssign({ open: true, zoneId: panelZone, quick: true })} onOpenMember={(id) => navigate(`/admin/members/${id}`)} />}
      </Drawer>
      <AssignDialog open={assign.open} onClose={() => setAssign({ open: false })} zoneId={assign.zoneId} positionId={assign.positionId} memberId={assign.memberId} quick={assign.quick} />
      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        title="Remove assignment?"
        description={toRemove ? `${fullName(memberMap.get(toRemove.memberId)!)} will become unassigned for ${data.event ? eventLabel(data.event) : ''}.` : undefined}
        confirmLabel="Remove"
        onConfirm={() => { confirmId && remove(confirmId); toast.success('Assignment removed.') }}
      />
      <span className={cn('hidden')} />
    </div>
  )
}
