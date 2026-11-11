import * as XLSX from 'xlsx'
import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, AlertTriangle, ArrowLeft, Check, CheckCircle2, Download, FileSpreadsheet, UploadCloud } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore, type ImportRow } from '@/store/useStore'
import { LIVE } from '@/lib/api'
import { importFileLive } from '@/lib/live'
import { useEventData } from '@/lib/selectors'
import { cn, downloadFile, formatPhone, isValidPhone, normalizePhone } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PageHeader, Select } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'

type Issue = { level: 'error' | 'warn'; msg: string }
type Parsed = ImportRow & { line: number; issues: Issue[] }

const STAGES = ['Upload', 'Preview', 'Validate', 'Import'] as const

const SAMPLE = `first_name,last_name,phone,email,gender,unit,zone,position
Tobi,Adeleke,0813 555 0101,tobi.adeleke@mail.com,Male,Team A,Aisle 3,Control 2
Amaka,Okonkwo,08165550102,,Female,Team B,Section 14,Seating Usher
Ibrahim,Garba,+2349035550103,,Male,Team C,Car Park,Traffic Direction
Esther,Etim,0706 555 0104,esther.etim@mail.com,Female,Team D,,
Kunle,,08025550105,,Male,Team A,Aisle 2,Control 1
Ruth,Bassey,,ruth.b@mail.com,Female,Team E,Gallery,Gallery Seating
Seun,Akande,08031234567,,Male,Team F,Aisle 9,Exit Control
Hauwa,Yakubu,0813 555 0101,,Female,Team B,Overflow,Overflow Seating
Victor,Ige,0817 55,,Male,Team C,Aisle 4,Control 1
Lydia,Osagie,07065550110,,Female,Team D,Aisle 12,Control 1
Godwin,Ogbonna,08145550111,,Male,Team A,Main Entrance,Welcome & Direction
Rita,Uzor,09075550112,,Female,Team F,Aisle 5,Usher Captain`

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = '' }
    else cur += c
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim()))
}

const pickKey = (h: string) => {
  const k = h.toLowerCase().replace(/[^a-z]/g, '')
  if (['firstname', 'first', 'givenname'].includes(k)) return 'firstName'
  if (['lastname', 'last', 'surname'].includes(k)) return 'lastName'
  if (['name', 'fullname'].includes(k)) return 'fullName'
  if (['phone', 'phonenumber', 'mobile', 'tel', 'telephone'].includes(k)) return 'phone'
  if (k === 'email' || k === 'emailaddress') return 'email'
  if (k === 'gender' || k === 'sex') return 'gender'
  if (['unit', 'team', 'teamunit'].includes(k)) return 'unit'
  if (['zone', 'aisle', 'zoneaisle', 'area'].includes(k)) return 'zone'
  if (['position', 'role'].includes(k)) return 'position'
  return null
}

export default function Import() {
  const navigate = useNavigate()
  const events = useStore((s) => s.events)
  const members = useStore((s) => s.members)
  const activeEventId = useStore((s) => s.activeEventId)
  const importRows = useStore((s) => s.importRows)
  const [eventId, setEventId] = useState(activeEventId)
  const data = useEventData(eventId)
  const [stage, setStage] = useState(0)
  const [fileName, setFileName] = useState('')
  const [raw, setRaw] = useState<string[][]>([])
  const [drag, setDrag] = useState(false)
  const [done, setDone] = useState<{ members: number; assignments: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const sourceFile = useRef<File | null>(null)
  const finish = async () => {
    try {
      const r = LIVE && sourceFile.current ? await importFileLive(sourceFile.current, eventId) : importRows(valid, eventId)
      setDone(r)
      setStage(3)
      toast.success(`${r.members} members imported.`)
    } catch (err) {
      toast.error('Import failed.', (err as Error).message)
    }
  }

  const load = async (file: File) => {
    try {
      let rows: string[][]
      if (/\.xlsx?$/i.test(file.name)) {
                const wb = XLSX.read(await file.arrayBuffer())
        rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }).map((r) => r.map(String))
      } else if (/\.csv$/i.test(file.name) || file.type.includes('csv') || file.type === 'text/plain') {
        rows = parseCSV(await file.text())
      } else {
        return toast.error('Unsupported file', 'Upload a .csv, .xlsx or .xls file.')
      }
      if (rows.length < 2) return toast.error('The file looks empty', 'It needs a header row and at least one member.')
      setFileName(file.name)
      setRaw(rows)
      sourceFile.current = file
      setStage(1)
    } catch {
      toast.error('Unable to read that file.', 'Check it isn’t password protected and try again.')
    }
  }

  const parsed = useMemo<Parsed[]>(() => {
    if (raw.length < 2) return []
    const keys = raw[0].map(pickKey)
    const existing = new Set(members.map((m) => m.phone))
    const seen = new Map<string, number>()
    return raw.slice(1).map((cells, i) => {
      const r: Record<string, string> = {}
      keys.forEach((k, j) => { if (k) r[k] = (cells[j] ?? '').trim() })
      if (r.fullName && !r.firstName) { const [f, ...l] = r.fullName.split(/\s+/); r.firstName = f; r.lastName = l.join(' ') }
      const phone = normalizePhone(r.phone ?? '')
      const issues: Issue[] = []
      if (!r.firstName || !r.lastName) issues.push({ level: 'error', msg: 'Missing name' })
      if (!r.phone) issues.push({ level: 'error', msg: 'Missing phone number' })
      else if (!isValidPhone(phone)) issues.push({ level: 'error', msg: 'Invalid phone number' })
      else if (existing.has(phone)) issues.push({ level: 'error', msg: 'Phone already belongs to a member' })
      else if (seen.has(phone)) issues.push({ level: 'error', msg: `Duplicate of row ${seen.get(phone)}` })
      if (phone && !seen.has(phone)) seen.set(phone, i + 2)
      const g = r.gender?.toLowerCase()
      const gender = g?.startsWith('f') ? 'Female' : g?.startsWith('m') ? 'Male' : undefined
      if (r.gender && !gender) issues.push({ level: 'warn', msg: 'Unrecognised gender, left blank' })
      if (r.email && !/^\S+@\S+\.\S+$/.test(r.email)) issues.push({ level: 'warn', msg: 'Invalid email, left blank' })
      if (r.zone || r.position) {
        const z = data.zones.find((z) => z.name.toLowerCase() === r.zone?.toLowerCase())
        if (!z) issues.push({ level: 'warn', msg: `Unknown zone “${r.zone}”, imported unassigned` })
        else if (!(data.positionsByZone.get(z.id) ?? []).some((p) => p.name.toLowerCase() === r.position?.toLowerCase())) issues.push({ level: 'warn', msg: `Unknown position “${r.position}” in ${z.name}, imported unassigned` })
      }
      const zoneOk = !issues.some((x) => x.msg.startsWith('Unknown'))
      return {
        line: i + 2, issues, firstName: r.firstName ?? '', lastName: r.lastName ?? '', phone, gender,
        email: r.email && /^\S+@\S+\.\S+$/.test(r.email) ? r.email : undefined, unit: r.unit || undefined,
        zone: zoneOk ? r.zone : undefined, position: zoneOk ? r.position : undefined,
      }
    })
  }, [raw, members, data])

  const errors = parsed.filter((p) => p.issues.some((i) => i.level === 'error'))
  const warnings = parsed.filter((p) => !errors.includes(p) && p.issues.length)
  const valid = parsed.filter((p) => !errors.includes(p))
  const withAssign = valid.filter((p) => p.zone && p.position).length

  const reset = () => { setStage(0); setRaw([]); setFileName(''); setDone(null) }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Import members & roster" description="Bring in members from a CSV or Excel file. Rows with zone and position columns are assigned at the same time." />

      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Import progress">
        {STAGES.map((s, i) => (
          <li key={s} className="flex flex-col gap-2">
            <div className="h-1 overflow-hidden rounded-full bg-ink-900/[.06]"><motion.div className="h-full bg-wine-500" initial={false} animate={{ width: stage > i ? '100%' : stage === i ? '50%' : '0%' }} transition={{ duration: 0.4 }} /></div>
            <span className={cn('flex items-center gap-1.5 text-xs font-medium', stage >= i ? 'text-ink-900' : 'text-ink-400')}>
              {stage > i ? <Check className="h-3.5 w-3.5 text-wine-600" /> : <span className="font-mono">{i + 1}</span>} {s}
            </span>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        {stage === 0 && (
          <motion.div key="up" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <label
              onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) load(f) }}
              className={cn('flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed bg-white px-6 py-16 text-center transition-colors', drag ? 'border-wine-400 bg-wine-50/40' : 'border-line-strong hover:border-ink-400')}
            >
              <motion.span animate={{ y: drag ? -4 : 0 }} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-paper text-wine-600 ring-1 ring-line"><UploadCloud className="h-6 w-6" /></motion.span>
              <span className="mt-5 text-[15px] font-semibold text-ink-900">Drop a CSV or Excel file here</span>
              <span className="mt-1 text-sm text-ink-500">or click to browse · .csv, .xlsx, .xls</span>
              <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = '' }} />
            </label>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-500">Columns: first_name, last_name, phone, email, gender, unit, zone, position</p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => downloadFile('member-import-template.csv', SAMPLE.split('\n')[0] + '\n')}><Download className="h-4 w-4" /> Template</Button>
                <Button variant="secondary" onClick={() => { setFileName('sample-members.csv'); setRaw(parseCSV(SAMPLE)); setStage(1) }}><FileSpreadsheet className="h-4 w-4" /> Try a sample file</Button>
              </div>
            </div>
          </motion.div>
        )}

        {(stage === 1 || stage === 2) && (
          <motion.div key="pv" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white px-5 py-4 sm:flex-row sm:items-center">
              <FileSpreadsheet className="h-5 w-5 text-ok-500" />
              <div className="flex-1"><div className="font-medium text-ink-900">{fileName}</div><div className="text-sm text-ink-500">{parsed.length} rows found</div></div>
              <label className="flex items-center gap-2 text-sm text-ink-600">Assign to <Select value={eventId} onChange={setEventId} className="w-40">{events.filter((e) => e.status !== 'archived').map((e) => <option key={e.id} value={e.id}>{e.code}</option>)}</Select></label>
            </div>
            {stage === 2 && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Summary tone="ok" icon={<CheckCircle2 className="h-4 w-4" />} n={valid.length} label="ready to import" sub={`${withAssign} with an assignment`} />
                <Summary tone="warn" icon={<AlertTriangle className="h-4 w-4" />} n={warnings.length} label="imported with warnings" sub="Details shown per row" />
                <Summary tone="bad" icon={<AlertCircle className="h-4 w-4" />} n={errors.length} label="will be skipped" sub="Fix and re-import later" />
              </div>
            )}
            <div className="surface overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-line bg-paper/60 text-left text-xs text-ink-500">
                    <tr><th className="px-4 py-3 font-medium">Row</th><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Phone</th><th className="px-4 py-3 font-medium">Unit</th><th className="px-4 py-3 font-medium">Zone · Position</th>{stage === 2 && <th className="px-4 py-3 font-medium">Validation</th>}</tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {parsed.slice(0, 200).map((p) => {
                      const err = p.issues.find((i) => i.level === 'error')
                      return (
                        <tr key={p.line} className={cn(stage === 2 && err && 'bg-bad-50/40')}>
                          <td className="px-4 py-2.5 font-mono text-xs text-ink-400">{p.line}</td>
                          <td className="px-4 py-2.5 text-ink-900">{[p.firstName, p.lastName].filter(Boolean).join(' ') || <span className="text-ink-400">—</span>}</td>
                          <td className="px-4 py-2.5 text-ink-700 tabular">{p.phone ? formatPhone(p.phone) : <span className="text-ink-400">—</span>}</td>
                          <td className="px-4 py-2.5 text-ink-600">{p.unit ?? '—'}</td>
                          <td className="px-4 py-2.5 text-ink-600">{raw[p.line - 1] && (() => { const keys = raw[0].map(pickKey); const z = raw[p.line - 1][keys.indexOf('zone')]; const po = raw[p.line - 1][keys.indexOf('position')]; return z ? `${z} · ${po}` : '—' })()}</td>
                          {stage === 2 && (
                            <td className="px-4 py-2.5">
                              {p.issues.length === 0 ? <span className="inline-flex items-center gap-1 text-ok-600"><Check className="h-3.5 w-3.5" /> Ready</span> : (
                                <ul className="space-y-0.5">{p.issues.map((i) => <li key={i.msg} className={cn('flex items-center gap-1.5 text-xs', i.level === 'error' ? 'text-bad-500' : 'text-warn-600')}>{i.level === 'error' ? <AlertCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{i.msg}</li>)}</ul>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => (stage === 1 ? reset() : setStage(1))}><ArrowLeft className="h-4 w-4" /> Back</Button>
              {stage === 1 ? <Button variant="primary" onClick={() => setStage(2)}>Validate {parsed.length} rows</Button> : (
                <Button variant="primary" disabled={!valid.length} onClick={finish}>Import {valid.length} members</Button>
              )}
            </div>
          </motion.div>
        )}

        {stage === 3 && done && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="surface flex flex-col items-center px-6 py-14 text-center">
            <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.3 }} className="flex h-14 w-14 items-center justify-center rounded-full bg-ok-50 text-ok-500 ring-1 ring-ok-500/20"><CheckCircle2 className="h-7 w-7" /></motion.span>
            <h2 className="mt-5 text-xl font-semibold text-ink-900">{done.members} members imported</h2>
            <p className="mt-1 text-sm text-ink-500">{done.assignments} were assigned to positions{errors.length ? `, ${errors.length} rows were skipped` : ''}.</p>
            <div className="mt-6 flex gap-2">
              <Button variant="secondary" onClick={reset}>Import another file</Button>
              <Button variant="primary" onClick={() => navigate('/admin/members')}>View members</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Summary({ tone, icon, n, label, sub }: { tone: 'ok' | 'warn' | 'bad'; icon: React.ReactNode; n: number; label: string; sub: string }) {
  const c = { ok: 'text-ok-600 bg-ok-50', warn: 'text-warn-600 bg-warn-50', bad: 'text-bad-500 bg-bad-50' }[tone]
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3.5">
      <div className="flex items-center gap-2"><span className={cn('rounded-full p-1', c)}>{icon}</span><span className="text-xl font-semibold text-ink-900 tabular">{n}</span><span className="text-sm text-ink-600">{label}</span></div>
      <p className="mt-1 text-xs text-ink-500">{sub}</p>
    </div>
  )
}
