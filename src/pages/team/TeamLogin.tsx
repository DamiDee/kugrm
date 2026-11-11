import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { LIVE } from '@/lib/api'
import { teamFallback, teamRequestCode, teamVerify } from '@/lib/live'
import { ApiError } from '@/lib/api'
import { DEMO } from '@/data/mock'
import { formatPhone, formatPhoneInput, isValidNigerianPhone } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Field, Logo, Segmented } from '@/components/ui/misc'

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

  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [method, setMethod] = useState<'key' | 'sms'>('key')
  const [key, setKey] = useState('')

  const pickMethod = (m: 'key' | 'sms') => { setMethod(m); setError(''); setSent(false); setCode('') }

  const submitLive = async () => {
    setBusy(true)
    try {
      if (method === 'key') {
        await teamFallback(phone, key)
        setKey('')
        navigate('/team', { replace: true })
      } else if (!sent) {
        await teamRequestCode(phone)
        setSent(true)
      } else {
        await teamVerify(phone, code.trim())
        navigate('/team', { replace: true })
      }
    } catch (err) {
      const e = err as ApiError
      if (e.code === 'DELIVERY_UNAVAILABLE') {
        setMethod('key')
        setError('Text messages aren’t available right now. Sign in with your offline key instead.')
      } else if (e.code === 'RATE_LIMITED' || e.status === 429) setError('Too many attempts. Please wait 15 minutes and try again.')
      else if (e.code === 'BAD_FALLBACK_KEY') setError('That phone number and key don’t match an active coordinator or leader.')
      else setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const submit = (e?: React.SyntheticEvent) => {
    e?.preventDefault()
    if (!isValidNigerianPhone(phone)) return setError('Enter the 11-digit number registered with the department.')
    if (LIVE) {
      if (method === 'key' && !/^[A-Za-z0-9]{6}$/.test(key.trim())) return setError('Enter your 6-character key, letters and digits only.')
      if (method === 'sms' && sent && !/^\d{6}$/.test(code.trim())) return setError('Enter the 6-digit code we sent you.')
      setError('')
      return void submitLive()
    }
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
          <h1 className="mt-5 text-[44px] font-light leading-[1.02] tracking-[-0.035em]">Your team,<br /><span className="tga-gold-text">every session.</span></h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">Sign in with your registered phone number to see your sections, the ushers in them, and anyone who can’t make it.</p>
          <form onSubmit={submit} className="mt-8 rounded-[22px] bg-white p-5 text-ink-900" noValidate>
            {LIVE && (
              <div className="mb-4">
                <Segmented id="tl-m" size="sm" value={method} onChange={pickMethod} options={[{ value: 'key', label: 'Offline key' }, { value: 'sms', label: 'SMS code' }]} />
              </div>
            )}
            <Field label="Phone number" htmlFor="tl-p" error={error}>
              <input
                id="tl-p" className="field h-12 text-[17px] tabular" inputMode="tel" autoComplete="tel" placeholder="0802 000 1122"
                value={phone} disabled={sent && method === 'sms'} onChange={(e) => { setPhone(formatPhoneInput(e.target.value)); setError('') }}
              />
            </Field>
            {LIVE && method === 'key' && (
              <Field label="Offline key" htmlFor="tl-k" className="mt-4" hint="The 6-character key the admin team gave you.">
                <input id="tl-k" className="field h-12 font-mono text-[17px] uppercase tracking-[0.3em]" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={6} value={key} onChange={(e) => { setKey(e.target.value.replace(/[^a-z0-9]/gi, '')); setError('') }} />
              </Field>
            )}
            {sent && method === 'sms' && (
              <Field label="6-digit code" htmlFor="tl-c" className="mt-4">
                <input id="tl-c" className="field h-12 text-[17px] tabular" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError('') }} />
              </Field>
            )}
            <Button type="submit" variant="primary" size="lg" className="mt-4 w-full" disabled={busy}>{LIVE && method === 'sms' && !sent ? 'Send code' : 'Sign in'} <ArrowRight className="h-4 w-4" /></Button>
          </form>
          {!LIVE && <p className="mt-5 text-xs leading-relaxed text-white/45">
            Demo numbers: coordinator {formatPhone(DEMO.coordinator)} (Sections 40–43), leader {formatPhone(DEMO.leader)} (Nave B).
          </p>}
        </main>
      </div>
    </div>
  )
}
