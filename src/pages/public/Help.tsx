import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { PublicFooter, PublicNav } from '@/components/public/PublicShell'
import { useStore } from '@/store/useStore'
import { DEMO } from '@/data/mock'
import { formatPhone, telHref } from '@/lib/utils'

const faqs = [
  ['Which number should I use?', 'Use the phone number you gave the department when you registered. Leading +234 or 0 both work.'],
  ['It says my roster is not available yet.', 'Your profile exists but you have not been given a position for this event. Your unit head or the secretariat will assign you before the roster is published.'],
  ['It says the roster is coming soon.', 'Administrators prepare rosters privately first. Assignments become visible the moment the roster is published.'],
  ['My assignment looks wrong.', 'Speak to your aisle lead or contact the department secretariat. Do not swap positions informally; changes must be made on the roster.'],
  ['Do I need an account?', 'No. Only administrators sign in. Ushers only need their phone number.'],
]

export default function Help() {
  const settings = useStore((s) => s.settings)
  return (
    <div className="min-h-[100dvh] bg-canvas">
      <div className="p-2 sm:p-3 md:p-4">
        <div className="relative overflow-hidden rounded-[22px] bg-paper ring-1 ring-line sm:rounded-shell">
          <PublicNav tone="light" />
          <main className="mx-auto max-w-3xl px-5 pb-16 pt-12 md:pt-20">
            <span className="eyebrow">Help</span>
            <h1 className="mt-3 text-4xl font-light tracking-[-0.03em] text-ink-900 sm:text-5xl">Finding your assignment</h1>
            <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
              {['Enter your registered phone number', 'See your aisle or zone and position', 'Meet your team and lead on the day'].map((s, i) => (
                <li key={s} className="bg-white p-5">
                  <span className="font-mono text-xs text-wine-500">0{i + 1}</span>
                  <p className="mt-2 text-[15px] font-medium text-ink-900">{s}</p>
                </li>
              ))}
            </ol>
            <dl className="mt-12 divide-y divide-line border-y border-line">
              {faqs.map(([q, a]) => (
                <div key={q} className="grid gap-2 py-5 sm:grid-cols-[.9fr_1.1fr] sm:gap-8">
                  <dt className="font-medium text-ink-900">{q}</dt>
                  <dd className="text-[15px] leading-relaxed text-ink-500">{a}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-12 flex flex-col justify-between gap-4 rounded-2xl bg-ink-950 p-6 text-white sm:flex-row sm:items-center">
              <div>
                <div className="text-sm text-white/55">Still stuck?</div>
                <div className="mt-0.5 font-medium">{settings.contactName} · <a className="underline decoration-white/30 underline-offset-4" href={telHref(settings.contactPhone)}>{formatPhone(settings.contactPhone)}</a></div>
              </div>
              <Link to="/" className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-white px-5 text-sm font-semibold text-ink-900">Find my assignment <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <details className="mt-10 rounded-xl border border-dashed border-line-strong px-5 py-4 text-sm text-ink-600">
              <summary className="cursor-pointer font-medium text-ink-800">Demo numbers for testing</summary>
              <ul className="mt-3 space-y-1.5">
                <li><Link className="font-mono text-wine-600 underline-offset-4 hover:underline" to={`/assignment?phone=${DEMO.found}`}>{formatPhone(DEMO.found)}</Link> · Daniel Adeyemi, assigned to Aisle 3</li>
                <li><Link className="font-mono text-wine-600 underline-offset-4 hover:underline" to={`/assignment?phone=${DEMO.unassigned}`}>{formatPhone(DEMO.unassigned)}</Link> · Faith Ibrahim, member without an assignment</li>
                <li><Link className="font-mono text-wine-600 underline-offset-4 hover:underline" to={`/assignment?phone=${DEMO.missing}`}>{formatPhone(DEMO.missing)}</Link> · not registered</li>
                <li className="text-ink-500">Unpublish the roster from the admin dashboard to see “Roster coming soon”.</li>
              </ul>
            </details>
          </main>
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
