import { useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'
import { LIVE } from '@/lib/api'
import { createEventLive } from '@/lib/live'
import type { MinistryEvent } from '@/data/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'

export function EventForm({ open, onClose, event, onCreated }: { open: boolean; onClose: () => void; event?: MinistryEvent; onCreated?: (id: string) => void }) {
  const createEvent = useStore((s) => s.createEvent)
  const updateEvent = useStore((s) => s.updateEvent)
  const blank = { name: '', code: '', series: '', day: '', session: '', startTime: '', theme: '', description: '', date: '', reportingTime: '15:30', briefingTime: '16:00', venue: 'Koinonia Global Arena, Jabi District, Abuja', dressCode: 'Departmental Uniform', instructions: '', rosterStatus: 'draft' as MinistryEvent['rosterStatus'] }
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    if (open) { setF(event ? { ...blank, ...event, series: event.series ?? '', day: event.day ? String(event.day) : '', session: event.session ?? '', startTime: event.startTime ?? '', theme: event.theme ?? '', description: event.description ?? '', instructions: event.instructions ?? '', briefingTime: event.briefingTime ?? '', dressCode: event.dressCode ?? '' } : blank); setErrors({}) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }))

  const save = async (asDraft: boolean) => {
    const e: Record<string, string> = {}
    if (!f.name.trim()) e.name = 'Give the event a name'
    if (!f.code.trim()) e.code = 'Add a short code, e.g. TGA 2026'
    if (!f.date) e.date = 'Pick a date'
    if (!f.venue.trim()) e.venue = 'Add a venue'
    setErrors(e)
    if (Object.keys(e).length) return
    const payload = {
      ...f, name: f.name.trim(), code: f.code.trim().toUpperCase(), rosterStatus: asDraft ? 'draft' as const : f.rosterStatus,
      series: f.series.trim() || undefined, day: f.day ? Number(f.day) : undefined, session: (f.session || undefined) as MinistryEvent['session'],
      startTime: f.startTime || undefined, theme: f.theme.trim() || undefined,
    }
    if (event) {
      updateEvent(event.id, payload)
      toast.success('Event updated.')
    } else {
      let id: string
      try {
        id = LIVE ? await createEventLive({ ...payload, status: asDraft ? 'draft' : 'active' }) : createEvent({ ...payload, status: asDraft ? 'draft' : 'active' })
      } catch (err) {
        return toast.error('Event not created.', (err as Error).message)
      }
      toast.success(asDraft ? 'Event saved as draft.' : 'Event created.', 'Positions were copied from the current event.')
      onCreated?.(id)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={event ? `Edit ${event.code}` : 'Create event'}
      description={event ? undefined : 'Aisles, zones and positions are copied from the event you are working on, so you can start assigning straight away.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {!event && <Button variant="secondary" onClick={() => save(true)}>Save as draft</Button>}
          <Button variant="primary" onClick={() => save(false)}>{event ? 'Save changes' : 'Create Event'}</Button>
        </>
      }
    >
      <div className="grid gap-4 pb-2 sm:grid-cols-6">
        <Field label="Event name" htmlFor="ef-n" error={errors.name} className="sm:col-span-4"><input id="ef-n" className="field" value={f.name} onChange={set('name')} placeholder="The General Assembly 2027" /></Field>
        <Field label="Short code" htmlFor="ef-c" error={errors.code} className="sm:col-span-2"><input id="ef-c" className="field uppercase" value={f.code} onChange={set('code')} placeholder="TGA D1 AM" /></Field>
        <Field label="Description" htmlFor="ef-d" className="sm:col-span-6"><textarea id="ef-d" rows={2} className="field h-auto py-2" value={f.description} onChange={set('description')} /></Field>
        <Field label="Programme" htmlFor="ef-s" hint="Sessions with the same programme are grouped, e.g. TGA 2027" className="sm:col-span-3"><input id="ef-s" className="field" value={f.series} onChange={set('series')} placeholder="TGA 2027" /></Field>
        <Field label="Day" htmlFor="ef-day" className="sm:col-span-1"><input id="ef-day" type="number" min={1} className="field" value={f.day} onChange={set('day')} placeholder="1" /></Field>
        <Field label="Session" htmlFor="ef-ses" className="sm:col-span-2">
          <Select id="ef-ses" value={f.session} onChange={(v) => setF((s) => ({ ...s, session: v, ...(v === 'morning' && !s.startTime ? { startTime: '08:45', reportingTime: '07:30', briefingTime: '08:00' } : v === 'evening' && !s.startTime ? { startTime: '17:00', reportingTime: '15:45', briefingTime: '16:15' } : {}) }))}>
            <option value="">Single service</option>
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
          </Select>
        </Field>
        <Field label="Theme" htmlFor="ef-th" className="sm:col-span-6"><input id="ef-th" className="field" value={f.theme} onChange={set('theme')} placeholder="More Than Conquerors (Romans 8:37)" /></Field>
        <Field label="Event date" htmlFor="ef-dt" error={errors.date} className="sm:col-span-2"><input id="ef-dt" type="date" className="field" value={f.date} onChange={set('date')} /></Field>
        <Field label="Service starts" htmlFor="ef-st" className="sm:col-span-2"><input id="ef-st" type="time" className="field" value={f.startTime} onChange={set('startTime')} /></Field>
        <Field label="Reporting time" htmlFor="ef-rt" className="sm:col-span-2"><input id="ef-rt" type="time" className="field" value={f.reportingTime} onChange={set('reportingTime')} /></Field>
        <Field label="Briefing time" htmlFor="ef-bt" className="sm:col-span-3"><input id="ef-bt" type="time" className="field" value={f.briefingTime} onChange={set('briefingTime')} /></Field>
        <Field label="Venue" htmlFor="ef-v" error={errors.venue} className="sm:col-span-3"><input id="ef-v" className="field" value={f.venue} onChange={set('venue')} /></Field>
        <Field label="Dress code" htmlFor="ef-dc" className="sm:col-span-3"><input id="ef-dc" className="field" value={f.dressCode} onChange={set('dressCode')} /></Field>
        <Field label="General instructions" htmlFor="ef-i" hint="Shown to every usher as an Important Notice." className="sm:col-span-6"><textarea id="ef-i" rows={3} className="field h-auto py-2" value={f.instructions} onChange={set('instructions')} placeholder="All ushers must report at least 30 minutes before the department briefing." /></Field>
        <Field label="Roster publication status" htmlFor="ef-r" className="sm:col-span-3">
          <Select id="ef-r" value={f.rosterStatus} onChange={(v) => setF((s) => ({ ...s, rosterStatus: v as MinistryEvent['rosterStatus'] }))}>
            <option value="draft">Draft: hidden from ushers</option>
            <option value="published">Published: visible to ushers</option>
          </Select>
        </Field>
      </div>
    </Modal>
  )
}
