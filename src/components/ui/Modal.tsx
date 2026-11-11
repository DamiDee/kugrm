import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import { X, AlertTriangle } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils'

/**
 * Page scrolling stays locked while any dialog, drawer or sheet is open. A
 * count, rather than saving and restoring the old value, so closing them in any
 * order can't leave the page stuck without scrolling.
 */
let scrollLocks = 0
export function lockScroll() {
  if (scrollLocks++ === 0) document.body.style.overflow = 'hidden'
  return () => {
    scrollLocks = Math.max(0, scrollLocks - 1)
    if (scrollLocks === 0) document.body.style.overflow = ''
  }
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    const unlock = lockScroll()
    return () => {
      window.removeEventListener('keydown', h)
      unlock()
    }
  }, [open, onClose])
}

/**
 * The full-screen layer behind a dialog, drawer or menu. It has to be a motion
 * element so AnimatePresence removes it once closing has finished; a plain div
 * here stays on top of the page, invisible, and blocks every tap. While it is
 * closing it already lets taps through.
 */
export function Layer({ className, children }: { className: string; children: React.ReactNode }) {
  const present = useIsPresent()
  return (
    <motion.div className={className} style={{ pointerEvents: present ? undefined : 'none' }} initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {children}
    </motion.div>
  )
}

function useAutoFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const t = setTimeout(() => {
      if (ref.current?.contains(document.activeElement)) return
      const el = ref.current?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea, button:not([data-close])')
      el?.focus()
    }, 40)
    return () => {
      clearTimeout(t)
      prev?.focus?.()
    }
  }, [open])
  return ref
}

export function Modal({
  open, onClose, title, description, children, footer, size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  useEscape(open, onClose)
  const ref = useAutoFocus(open)
  return createPortal(
    <AnimatePresence>
      {open && (
        <Layer className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <motion.div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={onClose} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className={cn('relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-float sm:rounded-2xl', { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }[size])}
          >
            <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
              <div>
                <h2 className="text-[17px] font-semibold tracking-tight text-ink-900">{title}</h2>
                {description && <p className="mt-1 text-sm leading-relaxed text-ink-500">{description}</p>}
              </div>
              <Button data-close variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {children && <div className="scrollbar-thin overflow-y-auto px-6 py-3">{children}</div>}
            {footer && <div className="flex flex-col-reverse gap-2 border-t border-line bg-paper px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>}
          </motion.div>
        </Layer>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', tone = 'danger', children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  tone?: 'danger' | 'primary' | 'accent'
  children?: React.ReactNode
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-2.5">
          {tone === 'danger' && <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bad-50 text-bad-500"><AlertTriangle className="h-4 w-4" /></span>}
          {title}
        </span>
      }
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={tone} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}

export function Drawer({ open, onClose, children, label, width = 'max-w-md' }: { open: boolean; onClose: () => void; children: React.ReactNode; label: string; width?: string }) {
  useEscape(open, onClose)
  const ref = useAutoFocus(open)
  return createPortal(
    <AnimatePresence>
      {open && (
        <Layer className="fixed inset-0 z-40">
          <motion.div className="absolute inset-0 bg-ink-950/25" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className={cn('absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-float sm:border-l sm:border-line', width)}
          >
            {children}
          </motion.aside>
        </Layer>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** A sheet that slides up from the bottom on phones. */
export function BottomSheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: React.ReactNode; label: string }) {
  useEscape(open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <Layer className="fixed inset-0 z-40">
          <motion.div className="absolute inset-0 bg-ink-950/25" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute inset-x-0 bottom-0 flex max-h-[82dvh] flex-col rounded-t-[22px] bg-white pb-[env(safe-area-inset-bottom)] shadow-float"
          >
            <SheetHandle onClose={onClose} />
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
          </motion.aside>
        </Layer>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function SheetHandle({ onClose }: { onClose: () => void }) {
  return (
    <button onClick={onClose} aria-label="Close" className="flex w-full shrink-0 justify-center pb-1 pt-2.5">
      <span className="h-1.5 w-10 rounded-full bg-ink-900/15" />
    </button>
  )
}
