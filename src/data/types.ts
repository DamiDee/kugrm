export type Gender = 'Male' | 'Female'

export interface Member {
  id: string
  firstName: string
  lastName: string
  phone: string // stored normalised: 11 digits, e.g. 08031234567
  email?: string
  memberId?: string
  gender?: Gender
  unit?: string
  status: 'active' | 'inactive'
  joinedYear?: number
}

export type EventStatus = 'draft' | 'active' | 'completed' | 'archived'
export type RosterStatus = 'draft' | 'published'

export interface MinistryEvent {
  id: string
  name: string
  code: string
  description?: string
  date: string // ISO date
  venue: string
  reportingTime: string // "15:30"
  briefingTime?: string
  dressCode?: string
  status: EventStatus
  rosterStatus: RosterStatus
  instructions?: string
  publishedAt?: string
}

export type ZoneKind = 'aisle' | 'section' | 'door' | 'area'

export interface Zone {
  id: string
  name: string
  eventId: string
  kind: ZoneKind
  order: number
  /** Where the zone sits on the floor plan: S1–S70, A1–A6, a door code, or an area ref. See data/venue.ts. */
  mapRef?: string
}

/** An usher spot in a section: front or back row, left or right end, facing the altar. */
export type SpotKey = 'FL' | 'FR' | 'BL' | 'BR'

export interface Position {
  id: string
  name: string
  zoneId: string
  order: number
  isLeadRole?: boolean
  /** target headcount, used for coverage */
  required?: number
  /** the usher spot on the floor plan this position stands at (one person) */
  spot?: SpotKey
}

export interface Assignment {
  id: string
  memberId: string
  eventId: string
  zoneId: string
  positionId: string
  isTeamLead: boolean
  status: 'assigned' | 'confirmed'
  updatedAt: string
}

export interface Activity {
  id: string
  actor: string
  text: string
  at: string
  kind: 'assign' | 'event' | 'import' | 'publish' | 'member' | 'position'
}

export interface AppNotification {
  id: string
  title: string
  body: string
  at: string
  tone: 'info' | 'success' | 'warn'
  read: boolean
}
