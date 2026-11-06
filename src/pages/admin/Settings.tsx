import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/Button'
import { Field, PageHeader, Switch } from '@/components/ui/misc'
import { ConfirmDialog } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { EventSelector } from '@/components/admin/EventSelector'
import { formatPhone, isValidNigerianPhone, normalizePhone } from '@/lib/utils'

export default function Settings() {
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.updateSettings)
  const reset = useStore((s) => s.resetDemo)
  const [name, setName] = useState(settings.contactName)
  const [phone, setPhone] = useState(formatPhone(settings.contactPhone))
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="How the usher-facing lookup behaves." />
      <div className="divide-y divide-line rounded-2xl border border-line bg-white">
        <Row title="Current event" desc="The event ushers see by default when they search their number.">
          <EventSelector />
        </Row>
        <Row title="Show teammates’ phone numbers" desc="Ushers can tap to call people on their aisle or zone.">
          <Switch checked={settings.showTeammatePhones} onChange={(v) => update({ showTeammatePhones: v })} label="Show teammates’ phone numbers" />
        </Row>
        <Row title="Let ushers confirm attendance" desc="Adds a Confirm attendance button to the assignment page.">
          <Switch checked={settings.allowSelfConfirm} onChange={(v) => update({ allowSelfConfirm: v })} label="Let ushers confirm attendance" />
        </Row>
        <div className="p-5">
          <h3 className="text-sm font-semibold text-ink-900">Administrator contact</h3>
          <p className="mt-0.5 text-sm text-ink-500">Shown when a number can’t be found.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="cn"><input id="cn" className="field" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Phone" htmlFor="cp"><input id="cp" className="field tabular" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          </div>
          <Button className="mt-4" variant="primary" onClick={() => { if (!isValidNigerianPhone(phone)) return toast.error('Unable to save changes.', 'Enter a valid Nigerian phone number.'); update({ contactName: name, contactPhone: normalizePhone(phone) }); toast.success('Settings saved.') }}>Save contact</Button>
        </div>
      </div>
      <div className="mt-8 rounded-2xl border border-dashed border-line-strong p-5">
        <h3 className="text-sm font-semibold text-ink-900">Demo data</h3>
        <p className="mt-0.5 text-sm text-ink-500">Data is stored in this browser until a backend is connected. Restore the original sample roster at any time.</p>
        <Button className="mt-4" variant="secondary" onClick={() => setConfirm(true)}><RotateCcw className="h-4 w-4" /> Reset demo data</Button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Reset demo data?" description="All members, events and assignments return to the original sample. Your changes will be lost." confirmLabel="Reset data" onConfirm={() => { reset(); toast.success('Demo data restored.') }} />
    </div>
  )
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h3 className="text-sm font-semibold text-ink-900">{title}</h3><p className="mt-0.5 text-sm text-ink-500">{desc}</p></div>
      {children}
    </div>
  )
}
