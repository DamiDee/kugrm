import type { Duty } from './types'

export const DUTY_LABEL: Record<Duty, string> = {
  seat: 'Usher seat',
  crowd: 'Crowd control',
  greeter: 'Greeter',
  door: 'Door duty',
  lead: 'Lead',
  protocol: 'Protocol',
  support: 'Support',
}

export const DUTY_HINT: Record<Duty, string> = {
  seat: 'Stands at a marked usher seat in a section',
  crowd: 'Keeps aisles and walkways moving',
  greeter: 'Welcomes people at the doors and gates',
  door: 'Holds a door: entry, exit or keeping it shut',
  lead: 'Leads the team in a zone',
  protocol: 'Ministers, guests and the altar',
  support: 'Desks, first aid, car park and other support',
}

export const DUTIES = Object.keys(DUTY_LABEL) as Duty[]

/** A sensible duty for positions that predate the field. */
export function dutyOf(p: { duty?: Duty; spot?: unknown; isLeadRole?: boolean; name: string }): Duty {
  if (p.duty) return p.duty
  if (p.spot) return 'seat'
  if (p.isLeadRole) return 'lead'
  const n = p.name.toLowerCase()
  if (n.includes('greet') || n.includes('welcome')) return 'greeter'
  if (n.includes('crowd') || n.includes('control') || n.includes('marshal')) return 'crowd'
  if (n.includes('door')) return 'door'
  if (n.includes('protocol') || n.includes('escort')) return 'protocol'
  return 'support'
}
