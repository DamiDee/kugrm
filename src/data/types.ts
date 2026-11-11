export type Gender = 'Male' | 'Female'

export interface Member {
  id: string
  firstName: string
  lastName: string
  phone: string // stored normalised: 08031234567 for Nigeria, +447911123456 elsewhere
  email?: string
  memberId?: string
  gender?: Gender
  unit?: string
  status: 'active' | 'inactive'
  joinedYear?: number
  /** coordinators oversee a set of zones; leaders oversee coordinators */
  role?: MemberRole
  /** for a coordinator: the leader they report to (single leader) */
  leaderId?: string
  /** for a coordinator: the leaders they report to (supports multiple leaders) */
  leaderIds?: string[]
  /** for a coordinator: the zones they oversee, by name ("Section 41", "Aisle 5", "Door X3"), in every session */
  coordinates?: string[]
}

export type MemberRole = 'usher' | 'coordinator' | 'leader'
export type AdminRole = 'owner' | 'admin' | 'editor'

export interface FallbackKeyResponse {
  memberId: string
  key: string
  rotatedAt: string
}
export type SessionPeriod = 'morning' | 'evening'

export type EventStatus = 'draft' | 'active' | 'completed' | 'archived'
export type RosterStatus = 'draft' | 'published'

/**
 * One service the department rosters for. A multi-day programme such as TGA
 * is one event per session (day × morning/evening), grouped by `series`, so
 * each session has its own roster, reporting time and absences.
 */
export interface MinistryEvent {
  id: string
  name: string
  code: string
  description?: string
  date: string // ISO date
  venue: string
  /** groups the sessions of one programme, e.g. "TGA 2026" */
  series?: string
  /** day number within the series, 1-based */
  day?: number
  session?: SessionPeriod
  /** when the service starts, "08:45" */
  startTime?: string
  /** when ushers must report, "07:30"; differs between morning and evening */
  reportingTime: string
  theme?: string
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
  /** what the people in this position do */
  duty?: Duty
}

/** seat: an usher seat in a section; crowd: crowd control; greeter: welcomes people at doors and gates; door: door duty. */
export type Duty = 'seat' | 'crowd' | 'greeter' | 'door' | 'lead' | 'protocol' | 'support'

export interface Assignment {
  id: string
  memberId: string
  eventId: string
  zoneId: string
  positionId: string
  isTeamLead: boolean
  /** unavailable: the usher said they can't make this session, so the spot is open for cover */
  status: 'assigned' | 'confirmed' | 'unavailable'
  unavailableReason?: string
  updatedAt: string
}

export interface Activity {
  id: string
  actor: string
  text: string
  at: string
  kind: 'assign' | 'event' | 'import' | 'publish' | 'member' | 'position' | 'absence' | 'team'
}

export interface AppNotification {
  id: string
  title: string
  body: string
  at: string
  tone: 'info' | 'success' | 'warn'
  read: boolean
}
