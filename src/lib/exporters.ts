import * as XLSX from 'xlsx'
import { useStore } from '@/store/useStore'
import { computeEventData } from './selectors'
import { downloadFile, formatPhone, fullName, toCSV } from './utils'
import { toast } from '@/components/ui/Toast'
import { LIVE, apiFile, ApiError } from './api'

export type ExportKind = 'full' | 'aisle' | 'unassigned' | 'event' | 'contacts'
export type ExportFormat = 'csv' | 'excel' | 'pdf'

export function buildRows(kind: ExportKind, eventId: string, zoneId?: string) {
  const s = useStore.getState()
  const d = computeEventData(eventId, s)
  const code = d.event?.code ?? ''
  if (kind === 'unassigned') {
    return s.members.filter((m) => m.status === 'active' && !d.byMember.has(m.id)).map((m) => ({ Name: fullName(m), Phone: formatPhone(m.phone), 'Member ID': m.memberId ?? '', Unit: m.unit ?? '', Gender: m.gender ?? '' }))
  }
  if (kind === 'contacts') {
    return s.members.map((m) => ({ Name: fullName(m), Phone: formatPhone(m.phone), Email: m.email ?? '', Unit: m.unit ?? '', Status: m.status }))
  }
  const byId = new Map(s.members.map((m) => [m.id, m]))
  return d.assignments
    .filter((a) => kind !== 'aisle' || a.zoneId === zoneId)
    .map((a) => ({ a, m: byId.get(a.memberId)!, z: d.zoneById.get(a.zoneId)!, p: d.positionById.get(a.positionId)! }))
    .sort((x, y) => x.z.order - y.z.order || x.p.order - y.p.order || fullName(x.m).localeCompare(fullName(y.m)))
    .map(({ a, m, z, p }) => ({
      Event: code, Zone: z.name, Position: p.name, Name: fullName(m), Phone: formatPhone(m.phone),
      'Team Lead': a.isTeamLead ? 'Yes' : '', Status: a.status, ...(kind === 'event' ? { Unit: m.unit ?? '' } : {}),
    }))
}

export async function exportRoster(kind: ExportKind, format: ExportFormat, eventId: string, zoneId?: string) {
  if (LIVE) {
    try {
      const fmt = format === 'excel' ? 'xlsx' : format
      const { blob, name } = await apiFile(`/events/${eventId}/exports/${kind}`, { as: 'admin', query: { format: fmt, zoneId: kind === 'aisle' ? zoneId : undefined } })
      downloadFile(name ?? `roster-${kind}.${fmt}`, blob)
      toast.success('Export ready.')
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) toast.info('Nothing to export', 'There are no rows for this session yet.')
      else toast.error('Export failed.', (e as Error).message)
    }
    return
  }
  const s = useStore.getState()
  const ev = s.events.find((e) => e.id === eventId)
  const zone = zoneId ? s.zones.find((z) => z.id === zoneId) : undefined
  const rows = buildRows(kind, eventId, zoneId)
  const title = { full: 'Full roster', aisle: `${zone?.name ?? 'Zone'} roster`, unassigned: 'Unassigned members', event: 'Event roster', contacts: 'Contact list' }[kind]
  const base = `${(ev?.code ?? 'roster').replace(/\s+/g, '-')}-${title.toLowerCase().replace(/\s+/g, '-')}`
  if (!rows.length) return toast.info('Nothing to export', `${title} is empty for ${ev?.code}.`)

  if (format === 'csv') {
    downloadFile(`${base}.csv`, toCSV(rows))
  } else if (format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = Object.keys(rows[0]).map((k) => ({ wch: Math.max(k.length, 14) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 30))
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    downloadFile(`${base}.xlsx`, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  } else {
    const head = Object.keys(rows[0])
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} · ${ev?.code}</title>
      <style>body{font-family:Manrope,system-ui,sans-serif;color:#111827;margin:32px}h1{font-size:20px;margin:0}p{color:#6B7280;font-size:12px;margin:4px 0 20px}
      table{border-collapse:collapse;width:100%;font-size:11px}th{text-align:left;border-bottom:1.5px solid #111827;padding:6px 8px;font-weight:600}
      td{border-bottom:1px solid #E6E1D8;padding:5px 8px}tr:nth-child(even) td{background:#FBFAF7}</style></head>
      <body><h1>${title}</h1><p>${ev?.name ?? ''} · ${rows.length} rows · Generated ${new Date().toLocaleString('en-GB')}</p>
      <table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>
      ${rows.map((r) => `<tr>${head.map((h) => `<td>${String((r as Record<string, unknown>)[h] ?? '')}</td>`).join('')}</tr>`).join('')}
      </tbody></table></body></html>`
    const w = window.open('', '_blank')
    if (!w) {
      downloadFile(`${base}.html`, html, 'text/html')
      return toast.info('Pop-up blocked', 'Downloaded a printable file instead. Open it and choose Save as PDF.')
    }
    w.document.write(html)
    w.document.close()
    setTimeout(() => { try { w.focus(); w.print() } catch { /* user can print manually */ } }, 300)
  }
  toast.success(`${title} exported.`, `${rows.length.toLocaleString()} rows · ${format.toUpperCase()}`)
}
