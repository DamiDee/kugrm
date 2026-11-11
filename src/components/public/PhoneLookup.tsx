import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Phone, Search } from 'lucide-react'
import { cn, formatPhoneInput, isValidPhone, normalizePhone } from '@/lib/utils'

export function PhoneLookup({ initial = '', className, onDark = true, tga = false }: { initial?: string; className?: string; onDark?: boolean; /** gold button, for the TGA landing page */ tga?: boolean }) {
  const [value, setValue] = useState(formatPhoneInput(initial))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (loading) return
    const digits = normalizePhone(value)
    if (!digits) return setError('Enter the phone number you registered with the department.')
    if (!isValidPhone(digits)) return setError('That doesn’t look like a phone number. Use 11 digits for a Nigerian number (0801 234 5678), or include the country code for others (+44 7911 123456).')
    setError('')
    setLoading(true)
    // the lookup is instant; a short pause lets the scanning state register without feeling slow
    setTimeout(() => navigate(`/assignment?phone=${encodeURIComponent(digits)}`), 420)
  }

  return (
    <form onSubmit={submit} noValidate className={cn('relative', className)} aria-busy={loading}>
      <div
        className={cn(
          'relative overflow-hidden rounded-[22px] bg-white p-2 shadow-float ring-1 transition-shadow duration-200',
          error ? 'ring-bad-500/40' : tga ? 'ring-black/5 focus-within:ring-tga-gold/60 focus-within:shadow-[0_0_0_6px_rgba(217,180,90,.18),0_24px_64px_-16px_rgba(0,0,0,.5)]' : 'ring-black/5 focus-within:ring-wine-400/50 focus-within:shadow-[0_0_0_6px_rgba(147,48,78,.10),0_24px_64px_-16px_rgba(11,17,32,.28)]',
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <label htmlFor="phone" className="flex flex-1 items-center gap-3 rounded-2xl px-4 py-2.5 sm:py-1">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-ink-500 ring-1 ring-line">
              <Phone className="h-[18px] w-[18px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">Phone number</span>
              <input
                id="phone"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="0801 234 5678"
                value={value}
                disabled={loading}
                aria-invalid={!!error}
                aria-describedby={error ? 'phone-error' : undefined}
                onChange={(e) => { setValue(formatPhoneInput(e.target.value)); if (error) setError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
                className="w-full bg-transparent text-[22px] font-medium tracking-[0.02em] text-ink-900 tabular placeholder:text-ink-300 focus:outline-none disabled:text-ink-500 sm:text-2xl"
              />
            </span>
          </label>
          <motion.button
            type="button"
            onClick={() => submit()}
            whileTap={{ scale: 0.98 }}
            layout
            className={cn(
              'relative flex h-14 items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-7 text-[15px] font-semibold transition-colors sm:h-auto sm:min-w-[210px]',
              tga ? 'tga-gold-bg text-tga-black hover:brightness-105' : 'bg-wine-600 text-white hover:bg-wine-700',
              loading && 'bg-ink-900 hover:bg-ink-900',
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {loading ? (
                <motion.span key="l" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2.5">
                  <span className="relative flex h-4 w-4">
                    <span className="absolute inset-0 animate-ping rounded-full bg-gold-300/50" />
                    <Search className="relative h-4 w-4 text-gold-300" />
                  </span>
                  Checking the roster…
                </motion.span>
              ) : (
                <motion.span key="i" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  Find Assignment <ArrowRight className="h-4 w-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
        {/* scanning sweep */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-wine-100">
              <div className="h-full w-1/3 animate-scan bg-gradient-to-r from-transparent via-wine-500 to-transparent" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {error && (
          <motion.p id="phone-error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn('mt-3 px-2 text-sm', onDark ? 'text-[#FFD7DE]' : 'text-bad-500')}>
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  )
}
