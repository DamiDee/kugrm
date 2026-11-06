import { create } from 'zustand'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, XCircle, X } from 'lucide-react'
import { uid } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'info'
interface T { id: string; message: string; tone: ToastTone; detail?: string }

const useToasts = create<{ items: T[]; push: (t: Omit<T, 'id'>) => void; dismiss: (id: string) => void }>((set) => ({
  items: [],
  push: (t) => {
    const id = uid('t')
    set((s) => ({ items: [...s.items.slice(-3), { ...t, id }] }))
    setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== id) })), 3800)
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}))

export const toast = {
  success: (message: string, detail?: string) => useToasts.getState().push({ message, detail, tone: 'success' }),
  error: (message: string, detail?: string) => useToasts.getState().push({ message, detail, tone: 'error' }),
  info: (message: string, detail?: string) => useToasts.getState().push({ message, detail, tone: 'info' }),
}

const icon = {
  success: <CheckCircle2 className="h-[18px] w-[18px] text-ok-500" />,
  error: <XCircle className="h-[18px] w-[18px] text-bad-500" />,
  info: <Info className="h-[18px] w-[18px] text-gold-500" />,
}

export function Toaster() {
  const { items, dismiss } = useToasts()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:bottom-2 sm:items-end sm:p-6" aria-live="polite" role="status">
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-ink-900 px-4 py-3 text-white shadow-float"
          >
            <span className="mt-px rounded-full bg-white p-0.5">{icon[t.tone]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.message}</p>
              {t.detail && <p className="mt-0.5 text-xs text-white/60">{t.detail}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-white/50 hover:text-white" aria-label="Dismiss notification">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
