import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { LIVE } from '@/lib/api'
import { adminLogin } from '@/lib/live'
import { Button } from '@/components/ui/Button'
import { Field, Logo } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { FloorplanTexture } from '@/components/public/PublicShell'

export default function AdminLogin() {
  const login = useStore((s) => s.login)
  const navigate = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = useState(LIVE ? '' : 'admin@koinonia.org')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)

  const submit = (e?: React.SyntheticEvent) => {
    e?.preventDefault()
    const errs: typeof errors = {}
    if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Enter a valid email address.'
    if (LIVE ? !password : password.length < 4) errs.password = LIVE ? 'Enter your password.' : 'Enter your password (any 4+ characters in this demo).'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    if (LIVE) {
      adminLogin(email, password, remember)
        .then(() => navigate(loc.state?.from ?? '/admin', { replace: true }))
        .catch((err: Error) => { setErrors({ password: err.message }); setLoading(false) })
      return
    }
    setTimeout(() => {
      login(email, remember)
      navigate(loc.state?.from ?? '/admin', { replace: true })
    }, 450)
  }

  return (
    <div className="grid min-h-[100dvh] bg-canvas p-2 sm:p-3 md:p-4 lg:grid-cols-[1fr_1.05fr] lg:gap-4">
      <aside className="relative isolate hidden overflow-hidden rounded-shell bg-ink-950 p-10 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_0%_100%,rgba(147,48,78,.4),transparent_70%)]" />
        <FloorplanTexture className="-z-10 text-white/[.07]" />
        <Logo light />
        <div className="mt-auto max-w-md">
          <p className="text-[34px] font-light leading-tight tracking-[-0.02em]">
            Understand and manage thousands of assignments without feeling overwhelmed.
          </p>
          <p className="mt-5 text-sm text-white/50">Roster administration for the Koinonia Global Ushering Department.</p>
        </div>
      </aside>
      <main className="flex flex-col rounded-shell px-5 py-8 sm:px-10 lg:bg-paper lg:ring-1 lg:ring-line">
        <div className="flex items-center justify-between">
          <span className="lg:hidden"><Logo /></span>
          <Link to="/" className="ml-auto inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800"><ArrowLeft className="h-4 w-4" /> Usher lookup</Link>
        </div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="m-auto w-full max-w-sm py-10">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-wine-600 shadow-soft ring-1 ring-line"><Lock className="h-5 w-5" /></span>
          <h1 className="mt-6 text-[28px] font-semibold tracking-[-0.02em] text-ink-900">Administrator sign in</h1>
          <p className="mt-1.5 text-sm text-ink-500">For department administrators only. Ushers don’t need an account.</p>
          <form onSubmit={submit} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLInputElement).type !== 'checkbox') submit(e) }} noValidate className="mt-8 space-y-4">
            <Field label="Email" htmlFor="email" error={errors.email}>
              <input id="email" type="email" autoComplete="username" className="field h-11" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
            </Field>
            <Field label="Password" htmlFor="password" error={errors.password}>
              <div className="relative">
                <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" className="field h-11 pr-10" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} placeholder="••••••••" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-400 hover:text-ink-700" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <div className="flex items-center justify-between pt-1 text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-ink-700">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded accent-wine-600" />
                Remember me
              </label>
              <button type="button" className="font-medium text-wine-600 hover:text-wine-700" onClick={() => toast.info('Password reset link sent', `If ${email} is an admin account, a link is on its way.`)}>
                Forgot password?
              </button>
            </div>
            <Button variant="primary" size="lg" loading={loading} className="mt-2 w-full" onClick={submit}>Sign in</Button>
          </form>
          {!LIVE && <p className="mt-6 rounded-lg bg-ink-900/[.04] px-3 py-2.5 text-xs text-ink-500">Demo: any email and a password of 4+ characters will sign you in.</p>}
        </motion.div>
      </main>
    </div>
  )
}
