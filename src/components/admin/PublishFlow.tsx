import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, Send } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useEventData } from '@/lib/selectors'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'

export function PublishDialog({ eventId, open, onClose }: { eventId: string; open: boolean; onClose: () => void }) {
  const { event, stats } = useEventData(eventId)
  const setRosterStatus = useStore((s) => s.setRosterStatus)
  if (!event) return null
  const publishing = event.rosterStatus !== 'published'
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={publishing ? `Publish ${event.code} roster?` : `Unpublish ${event.code} roster?`}
      description={publishing ? 'You are about to make assignments visible to all members assigned to this event.' : 'Ushers will see “Roster coming soon” until you publish again. You can keep editing assignments in the meantime.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant={publishing ? 'accent' : 'primary'}
            onClick={() => {
              setRosterStatus(event.id, publishing ? 'published' : 'draft')
              toast.success(publishing ? 'Roster published.' : 'Roster moved back to draft.', publishing ? `${stats.assigned.toLocaleString()} ushers can now find their assignment.` : undefined)
              onClose()
            }}
          >
            {publishing ? <><Send className="h-4 w-4" /> Publish roster</> : <><EyeOff className="h-4 w-4" /> Unpublish</>}
          </Button>
        </>
      }
    >
      {publishing && (
        <dl className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-xl border border-line">
          {[
            ['Assigned', stats.assigned],
            ['Unassigned', stats.unassigned],
            ['Positions', stats.positions],
          ].map(([k, v]) => (
            <div key={k} className="px-4 py-3.5">
              <dt className="text-xs text-ink-500">{k}</dt>
              <dd className="mt-1 text-xl font-semibold tracking-tight text-ink-900 tabular">{Number(v).toLocaleString()}</dd>
            </div>
          ))}
        </dl>
      )}
      {publishing && stats.unassigned > 0 && (
        <p className="mt-3 text-sm text-ink-500">{stats.unassigned.toLocaleString()} members have no position and will see “Your roster is not available yet”.</p>
      )}
    </Modal>
  )
}

export function PublishButton() {
  const activeEventId = useStore((s) => s.activeEventId)
  const event = useStore((s) => s.events.find((e) => e.id === activeEventId))
  const [open, setOpen] = useState(false)
  if (!event) return null
  const published = event.rosterStatus === 'published'
  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        {published ? (
          <motion.button
            key="pub"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            onClick={() => setOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-ok-50 px-3 text-[13px] font-medium text-ok-600 ring-1 ring-inset ring-ok-500/20 hover:bg-ok-50/70"
            title="Roster is visible to ushers. Click to unpublish."
          >
            <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-ping rounded-full bg-ok-500/50" /><span className="relative h-2 w-2 rounded-full bg-ok-500" /></span>
            <span className="hidden sm:inline">Published</span>
            <Eye className="h-3.5 w-3.5 sm:hidden" />
          </motion.button>
        ) : (
          <motion.div key="draft" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}>
            <Button variant="accent" size="sm" className="h-9" onClick={() => setOpen(true)}><Send className="h-3.5 w-3.5" /><span className="hidden sm:inline">Publish Roster</span></Button>
          </motion.div>
        )}
      </AnimatePresence>
      <PublishDialog eventId={event.id} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
