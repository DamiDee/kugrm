import { cn, initials } from '@/lib/utils'

const palettes = [
  'bg-[#F1E6E9] text-[#651C35]',
  'bg-[#E9EDF3] text-[#2C3649]',
  'bg-[#F4ECDB] text-[#7F6229]',
  'bg-[#E6F0EA] text-[#246647]',
  'bg-[#ECE8F2] text-[#4B3F6B]',
  'bg-[#EFE9E2] text-[#5C4A36]',
]

export function Avatar({ first, last, size = 'md', className, ring }: { first: string; last?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string; ring?: boolean }) {
  const key = (first + (last ?? '')).split('').reduce((n, c) => n + c.charCodeAt(0), 0)
  const sz = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-[11px]', md: 'h-10 w-10 text-[13px]', lg: 'h-12 w-12 text-sm', xl: 'h-16 w-16 text-lg' }[size]
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide', palettes[key % palettes.length], ring && 'ring-2 ring-white', sz, className)}>
      {initials(first, last)}
    </span>
  )
}
