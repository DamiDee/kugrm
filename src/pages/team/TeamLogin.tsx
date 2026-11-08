import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { DEMO } from '@/data/mock'
import { formatPhone, formatPhoneInput, isValidNigerianPhone } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Field, Logo } from '@/components/ui/misc'

/**
 * Sign-in for section coordinators and leaders, by registered phone number.
 * In this demo the number alone signs you in; the live version sends a
 * one-time code to the number first (see docs/API.md).
 */
export default function TeamLogin() {
  const teamLogin = useStore((s) => s.teamLogin)
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  const submit = (e?: React.SyntheticEvent) => {
    e?.preventDefault()
    if (!isValidNigerianPhone(phone)) return setError('Enter the 11-digit number registered with the department.')
    const r = teamLogin(phone)
    if (r === 'not-found') return setError('No member has this number. Check it, or ask the department secretariat.')
    if (r === 'not-team') return setError('This number isn’t set up as a coordinator or leader. Ushers can find their assignment on the home page.')
    navigate('/team', { replace: true })
  }

  return (
    <div className="min-h-[100dvh] bg-tga-black text-white">
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 py-6">
        <header className="flex items-center justify-between">
          <Link to="/" aria-label="Home"><Logo light /></Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" /> Home</Link>
        </header>
        <main className="flex flex-1 flex-col justify-center py-10">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/[.07] px-3 py-1 text-xs font-medium text-tga-gold ring-1 ring-white/10"><ShieldCheck className="h-3.5 w-3.5" /> Coordinators and leaders</span>
          <h1 className="mt-5 font-display text-[44px] uppercase leading-[0.95] tracking-[0.01em]">Your team,<br /><span className="tga-gold-text">every session.</span></h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">Sign in with your registered phone number to see your sections, the ushers in them, and anyone who can’t make it.</p>
          <form onSubmit={submit} className="mt-8 rounded-[22px] bg-white p-5 text-ink-900" noValidate>
            <Field label="Phone number" htmlFor="tl-p" error={error}>
              <input
                id="tl-p" className="field h-12 text-[17px] tabular" inputMode="tel" autoComplete="tel" placeholder="0802 000 1122"
                value={phone} onChange={(e) => { setPhone(formatPhoneInput(e.target.value)); setError('') }}
              />
            </Field>
            <Button type="submit" variant="primary" size="lg" className="mt-4 w-full">Sign in <ArrowRight className="h-4 w-4" /></Button>
          </form>
          <p className="mt-5 text-xs leading-relaxed text-white/45">
            Demo numbers: coordinator {formatPhone(DEMO.coordinator)} (Sections 40–43), leader {formatPhone(DEMO.leader)} (Nave B).
          </p>
        </main>
      </div>
    </div>
  )
}
