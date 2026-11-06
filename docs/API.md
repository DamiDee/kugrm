# Global Roster Manager: Backend API Requirements

This is everything the frontend needs from the backend today: the usher-facing lookup site and the admin dashboard. It describes the data, every endpoint, and the rules the server must enforce. The frontend currently runs on demo data in the browser (`src/store/useStore.ts`, `src/data/mock.ts`). Each store action listed in the tables below maps to one endpoint here, so the frontend can switch over one call at a time.

Version 1 · 5 November 2026

---

## Contents

1. [Conventions](#1-conventions)
2. [Data models](#2-data-models)
3. [The floor plan and usher spots](#3-the-floor-plan-and-usher-spots)
4. [Public endpoints (ushers)](#4-public-endpoints-ushers)
5. [Admin: authentication](#5-admin-authentication)
6. [Admin: events](#6-admin-events)
7. [Admin: zones and positions](#7-admin-zones-and-positions)
8. [Admin: members](#8-admin-members)
9. [Admin: assignments](#9-admin-assignments)
10. [Admin: venue map](#10-admin-venue-map)
11. [Admin: dashboard, search, activity, notifications](#11-admin-dashboard-search-activity-notifications)
12. [Admin: import](#12-admin-import)
13. [Admin: reports and exports](#13-admin-reports-and-exports)
14. [Admin: settings](#14-admin-settings)
15. [Business rules the server must enforce](#15-business-rules-the-server-must-enforce)
    * [Open questions](#15a-open-questions-for-the-backend-developer)
16. [Endpoint index](#16-endpoint-index)

---

## 1. Conventions

| Item | Rule |
|---|---|
| Base URL | `/api/v1` |
| Format | JSON in and out (`Content-Type: application/json`), except file upload (multipart) and exports (file download). |
| Field names | `camelCase`. |
| IDs | Opaque strings (UUID or similar). The frontend never parses them. |
| Dates | `date` fields are ISO dates (`"2026-11-14"`). Times of day are `"HH:mm"` 24-hour strings (`"15:30"`). Timestamps are ISO 8601 UTC (`"2026-11-05T14:01:42Z"`). |
| Phone numbers | Stored and returned **normalised** as 11 Nigerian digits, `08031234567`. Accept input with spaces, dashes, `+234` or `234` prefixes and normalise it (see §15.1). |
| Auth | Admin endpoints need `Authorization: Bearer <accessToken>`. Public endpoints need no token. |
| Pagination | List endpoints take `page` (from 1) and `pageSize` (default 25, max 200). They return `{ "items": [...], "page": 1, "pageSize": 25, "total": 1284 }`. |
| Sorting | `sort=<field>` and `dir=asc|desc`. |
| Errors | A non-2xx status with `{ "error": { "code": "SPOT_TAKEN", "message": "Human readable text", "fields": { "phone": "Already used" } } }`. `fields` appears only for validation errors. |
| Status codes | `200` OK, `201` created, `204` no body, `400` validation, `401` not signed in, `403` not allowed, `404` not found, `409` conflict (duplicate phone, spot taken and `replace=false`, etc.), `422` business-rule failure, `429` rate limited. |
| CORS | Allow the frontend origin(s). The app is a static site (Vite build). |

---

## 2. Data models

These match `src/data/types.ts`. Optional fields are marked `?`.

### 2.1 Member (an usher in the department)

```json
{
  "id": "m_123",
  "firstName": "Daniel",
  "lastName": "Adeyemi",
  "phone": "08031234567",
  "email?": "daniel.adeyemi@mail.com",
  "memberId?": "KGU-1001",
  "gender?": "Male | Female",
  "unit?": "Team A",
  "status": "active | inactive",
  "joinedYear?": 2018,
  "createdAt": "…",
  "updatedAt": "…"
}
```

`phone` is unique across members. `memberId` is unique when present.

### 2.2 Event (a ministry programme with its own roster)

```json
{
  "id": "ev_tga26",
  "name": "The Global Apostolic Invasion 2026",
  "code": "TGA 2026",
  "description?": "…",
  "date": "2026-11-14",
  "venue": "Koinonia Global Centre, Abuja",
  "reportingTime": "15:30",
  "briefingTime?": "16:00",
  "dressCode?": "Departmental Uniform",
  "status": "draft | active | completed | archived",
  "rosterStatus": "draft | published",
  "publishedAt?": "…",
  "instructions?": "Shown to ushers on their assignment page",
  "createdAt": "…",
  "updatedAt": "…"
}
```

### 2.3 Zone (where a team serves: an aisle, a section, a door or an area)

```json
{
  "id": "z_1",
  "eventId": "ev_tga26",
  "name": "Section 41",
  "kind": "aisle | section | door | area",
  "order": 47,
  "mapRef?": "S41"
}
```

`mapRef` ties the zone to the floor plan (§3). Zones without one, such as the Car Park, are listed beside the map as "Outside the hall".

### 2.4 Position (a role inside a zone)

```json
{
  "id": "p_1",
  "zoneId": "z_1",
  "name": "Front row, left end",
  "order": 0,
  "required?": 1,
  "isLeadRole?": false,
  "spot?": "FL | FR | BL | BR"
}
```

* `required` is the target headcount, used for coverage.
* `spot` marks a position as one of the four **usher spots** of a section (§3.2). A spot holds exactly one usher, so its `required` is always 1.
* `isLeadRole` marks roles such as "Aisle Lead".

### 2.5 Assignment (a member placed in a position for an event)

```json
{
  "id": "as_1",
  "memberId": "m_123",
  "eventId": "ev_tga26",
  "zoneId": "z_1",
  "positionId": "p_1",
  "isTeamLead": false,
  "status": "assigned | confirmed",
  "updatedAt": "…"
}
```

### 2.6 Activity (audit feed)

```json
{ "id": "ac_1", "actor": "Grace", "text": "assigned 12 ushers to Aisle 4", "at": "…", "kind": "assign | event | import | publish | member | position" }
```

### 2.7 Notification (admin bell)

```json
{ "id": "n_1", "title": "Unassigned members remaining", "body": "364 members have no position for TGA 2026.", "at": "…", "tone": "info | success | warn", "read": false }
```

### 2.8 Settings

```json
{
  "currentEventId": "ev_tga26",
  "contactName": "Department Secretariat",
  "contactPhone": "08020001122",
  "showTeammatePhones": true,
  "allowSelfConfirm": true
}
```

### 2.9 Admin user

```json
{ "id": "u_1", "name": "Grace", "email": "grace@koinonia.org", "role": "owner | admin | editor" }
```

`editor` can assign and edit members but not publish, delete events or change settings. If you only need one role for now, ship `admin` and keep the field.

### 2.10 Computed: ZoneStat

Returned by several endpoints. Coverage is `min(100, round(assigned / required × 100))`. When `required` is 0, coverage is 100 if anyone is assigned, otherwise 0.

```json
{
  "zoneId": "z_1",
  "assigned": 3,
  "required": 4,
  "coverage": 75,
  "lead?": { "id": "m_2", "firstName": "John", "lastName": "Adewale", "phone": "08020001122" }
}
```

### 2.11 Computed: EventStats

```json
{
  "totalMembers": 1284,
  "assigned": 920,
  "unassigned": 364,
  "confirmed": 732,
  "positions": 377,
  "zones": 119,
  "required": 1001,
  "coverage": 71.7
}
```

`assigned` counts members with an assignment in the event. `unassigned = totalMembers − assigned`. `coverage` here is `assigned / totalMembers × 100`, rounded to one decimal place. This is the figure on the dashboard cards.

---

## 3. The floor plan and usher spots

The drawing itself lives in the frontend (`src/data/venue.ts`). The backend only stores **references** to it, so it never needs coordinates.

### 3.1 Plan references (`Zone.mapRef`)

| Ref | Meaning |
|---|---|
| `S1` … `S90` | Seating sections, 160 seats each (16 × 10). They are numbered column by column from the altar: the column nearest the altar holds 1–9, the back column 82–90. |
| `A1` … `A6` | Aisles 1–6 between the section rows. A3 and A4 sit either side of the central lane. |
| `E1` … `E4` | Entrance doors. |
| `X1` … `X4` | Exit doors. |
| `M1` | Access door for ministers and the Rotunda (leads onto the covered walkway). |
| `M2` | Access door for the worship team. |
| `M3` | Access door beside the worship team, near Section 1. |
| `altar` | Altar and pulpit platform (30 m, Nave B). |
| `worship` | Worship team area. |
| `screen` | Crane screen, in the 1 m strip behind the stage. |
| `tech` | Technical space (stage, beside the altar). |
| `walkway` | Covered, screened walkway from M1 to the stage. |
| `apostle` | The nine special chairs for the Apostle and guest ministers. |
| `protocol` | Protocol row (front row of Section 5). |
| `reserve` | The unlabelled stage reserve area. |

Fixed facts about sections, which the frontend already knows (listed here for reference):

* International guests: 7, 8, 15–17, 24–26.
* Lady Sandra's section: 4. Ministers, HODs and sons of the ministry: 6. Protocols: front row of 5. Media and technical: 32.
* Rows 1 and 9 (sections 1, 10, 19 … 82 and 9, 18, 27 … 90) were formed from the removed chairs.
* The two tent lines (between rows 3/4 and 6/7) are pillar lines, not aisles, so they have no `mapRef`.

### 3.2 Usher spots

Every section **except 1–9 and 32** has four usher spots, at the first and last row, both ends. That is 80 sections × 4 = **320 spots**. Each spot is a `Position` in that section's zone, with `spot` set:

| `spot` | Name | Where |
|---|---|---|
| `FL` | Front row, left end | Row nearest the altar, left as you face the altar |
| `FR` | Front row, right end | Row nearest the altar, right end |
| `BL` | Back row, left end | Back row, left end |
| `BR` | Back row, right end | Back row, right end |

The frontend draws a dot for each spot and fills it from the roster. A filled dot means someone is assigned to that position, and the usher's own dot is highlighted on their page. **The map is populated dynamically from the assignment endpoints; nothing about who stands where is hard-coded.**

Sections 1–9 and 32 have no spots. They get ordinary positions (the demo uses "Section Usher", required 2, and "Media Liaison" for 32).

### 3.3 Default venue template

When an event is created without a source event to copy from, the server should create this default structure (it is what `createSeed()` builds):

* 6 aisle zones `Aisle 1`–`Aisle 6` (`mapRef A1`–`A6`). Positions: Aisle Lead (1, lead role), Control 1 (6), Control 2 (6), Floor Marshal (30).
* 90 section zones `Section 1`–`Section 90` (`S1`–`S90`). Sections with spots get the four spot positions. Sections 1–9 get "Section Usher" (2) and Section 32 gets "Media Liaison" (2).
* 11 door zones `Door E1` … `Door M3` with one "Door Control" position each: 16 for entrances, 10 for exits, 8 for access doors.
* Area zones on the plan: Altar & Pulpit, Worship Team, Apostle's Chairs, Protocol Row, Technical Space, Covered Walkway.
* Area zones outside the hall (no `mapRef`): Main Gate, Registration Area, Car Park, Rotunda, Overflow, First Aid Point.

Expose the template as `GET /venue/template` (§7.6) so admins can rebuild an event's structure.

---

## 4. Public endpoints (ushers)

No auth. Rate-limit by IP: 20 lookups per minute is plenty. Never return other members' phone numbers unless `settings.showTeammatePhones` is true, and never return another member's email.

### 4.1 `GET /public/current-event`

Feeds the "Active event" card on the lookup page.

**200**
```json
{ "event": { "id": "…", "name": "…", "code": "TGA 2026", "date": "2026-11-14", "venue": "…", "reportingTime": "15:30", "briefingTime": "16:00", "dressCode": "…", "rosterStatus": "published" } }
```
`event` is `null` when no event is current.

### 4.2 `POST /public/lookup`

The core usher flow: enter a phone number and see the assignment.

**Body** `{ "phone": "0803 123 4567", "eventId?": "ev_…" }`. Without `eventId`, use `settings.currentEventId`.

**200** returns one of four results, told apart by `kind`:

```json
{ "kind": "not-found", "phone": "08099990000", "contact": { "name": "Department Secretariat", "phone": "08020001122" } }
```

```json
{ "kind": "unpublished", "member": { "firstName": "Faith" }, "event": { …Event }, "others": [ …AssignmentView ] }
```

```json
{ "kind": "unassigned", "member": { "firstName": "Faith" }, "event": { …Event }, "others": [ …AssignmentView ] }
```

```json
{
  "kind": "found",
  "member": { "id": "m_1", "firstName": "Daniel", "lastName": "Adeyemi" },
  "current": {
    "event": { …Event },
    "assignment": { "id": "as_1", "status": "confirmed", "isTeamLead": false },
    "zone": { "id": "z_s41", "name": "Section 41", "kind": "section", "mapRef": "S41" },
    "position": { "id": "p_s41_FL", "name": "Front row, left end", "spot": "FL" },
    "teamLead": { "firstName": "John", "lastName": "Adewale", "phone": "08020001122" },
    "teammates": [
      { "member": { "firstName": "Samuel", "lastName": "Adeyemi", "phone?": "08030004455" }, "position": { "id": "…", "name": "Front row, right end", "spot": "FR" }, "isTeamLead": false, "isYou": false }
    ]
  },
  "others": [ …AssignmentView for this member in other upcoming and past events ]
}
```

* `unpublished` means the member exists but the event roster is still a draft. Do **not** reveal their position.
* `others` lists the member's assignments in other events (upcoming first, then past). Each item has the same shape as `current`, without `teammates`.
* `teammates` covers everyone else in the same zone, ordered lead first, then by position order. Include `phone` only if `showTeammatePhones` is on.

### 4.3 `GET /public/events/{eventId}/map`

Fills the usher's floor plan: which spots are taken. Only for **published** events.

**200**
```json
{
  "zones": [ { "id": "z_s41", "name": "Section 41", "kind": "section", "mapRef": "S41" } ],
  "spots": [ { "positionId": "p_s41_FL", "zoneId": "z_s41", "spot": "FL", "name": "Front row, left end", "taken": true } ]
}
```

Return `taken` only, not names, for the public map. The usher's own teammates come from the lookup response.

To save a round trip, the server may embed this object in the `found` lookup response as `current.map`.

### 4.4 `POST /public/assignments/{assignmentId}/confirm`

"Confirm attendance" button. Only allowed when `settings.allowSelfConfirm` is true.

**Body** `{ "phone": "08031234567" }`. The phone must belong to the assignment's member, so ushers can't confirm for each other.

**200** `{ "assignment": { "id": "…", "status": "confirmed" } }`. **403** if self-confirm is off or the phone doesn't match.

### 4.5 `GET /public/settings`

**200** `{ "contactName": "…", "contactPhone": "…", "showTeammatePhones": true, "allowSelfConfirm": true }`

---

## 5. Admin: authentication

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/auth/login` | Body `{ "email", "password", "remember": true }`. **200** `{ "accessToken", "refreshToken", "expiresIn": 3600, "user": AdminUser }`. **401** on bad credentials. |
| `POST` | `/auth/refresh` | Body `{ "refreshToken" }`. **200** returns new tokens. |
| `POST` | `/auth/logout` | Revokes the refresh token. **204**. |
| `GET` | `/auth/me` | **200** `AdminUser`. Used on page load to keep the session. |
| `POST` | `/auth/forgot-password` | Body `{ "email" }`. **204** always, so the response never reveals whether an account exists. |
| `POST` | `/auth/reset-password` | Body `{ "token", "password" }`. **204**. |

`remember: true` gives a long-lived refresh token (30 days). Otherwise the session lasts until the browser closes (12 hours max).

---

## 6. Admin: events

| Method | Path | Store action | Notes |
|---|---|---|---|
| `GET` | `/events` | list | Query: `status` (comma list), `q`. Returns all events (there are few), each with `stats: EventStats`. Used by the event selector, the Events page and the Rosters page. |
| `POST` | `/events` | `createEvent` | Body: Event fields. Optional `copyStructureFrom: eventId` copies that event's zones and positions (default: the current event). Optional `useTemplate: true` builds §3.3 instead. **201** Event. |
| `GET` | `/events/{id}` | | Event plus `stats`. |
| `PATCH` | `/events/{id}` | `updateEvent` | Partial update. |
| `POST` | `/events/{id}/duplicate` | `duplicateEvent` | Copies the event, its zones and positions (not assignments). Name gets " (Copy)", code gets " COPY", status `draft`, rosterStatus `draft`. **201** Event. |
| `POST` | `/events/{id}/archive` | `archiveEvent` | Sets status `archived`. |
| `DELETE` | `/events/{id}` | `deleteEvent` | Deletes the event with its zones, positions and assignments. Refuse (**422**) for the current event. |
| `POST` | `/events/{id}/publish` | `setRosterStatus('published')` | Sets `rosterStatus=published`, `publishedAt=now`. Ushers can now see positions. Logs activity and creates a notification. |
| `POST` | `/events/{id}/unpublish` | `setRosterStatus('draft')` | Hides positions from ushers again. |
| `PUT` | `/settings/current-event` | `setActiveEvent` | Body `{ "eventId" }`. This is the event the lookup uses by default. |

---

## 7. Admin: zones and positions

The Positions page, the board and every zone dropdown use these.

| Method | Path | Store action | Notes |
|---|---|---|---|
| `GET` | `/events/{eventId}/zones` | | Query `include=positions,stats`. Returns zones in `order`, each with `positions[]` (ordered) and `stats: ZoneStat`. **This one call is enough to draw the board and the zone lists.** |
| `POST` | `/events/{eventId}/zones` | `addZone` | Body `{ "name", "kind", "mapRef?" }`. If `mapRef` is missing, derive it from the name ("Section 14" → `S14`, "Aisle 2" → `A2`, "Door E1" → `E1`). **409** if another zone in the event already has that `mapRef`. Adding a section zone that has spots should create its four spot positions automatically. |
| `PATCH` | `/zones/{zoneId}` | `renameZone` | `{ "name?", "mapRef?", "order?" }`. |
| `DELETE` | `/zones/{zoneId}` | `deleteZone` | Also deletes its positions and assignments. |
| `PUT` | `/events/{eventId}/zones/order` | | Body `{ "zoneIds": [...] }`. |
| `POST` | `/zones/{zoneId}/positions` | `addPosition` | `{ "name", "required?": 4, "isLeadRole?", "spot?" }`. **409** if the zone already has a position with that `spot`. |
| `PATCH` | `/positions/{positionId}` | `updatePosition` | `{ "name?", "required?", "isLeadRole?" }`. `required` must stay 1 for spot positions. |
| `DELETE` | `/positions/{positionId}` | `deletePosition` | Also deletes its assignments. |
| `PUT` | `/zones/{zoneId}/positions/order` | `reorderPositions` | Body `{ "positionIds": [...] }`. |
| `GET` | `/venue/template` | | Returns the §3.3 default structure as `{ zones: [{ name, kind, mapRef, positions: [...] }] }`. |
| `POST` | `/events/{eventId}/zones/apply-template` | | Adds any template zones and positions the event is missing. Body `{ "mode": "add-missing" }`. Never deletes. |

---

## 8. Admin: members

| Method | Path | Store action | Notes |
|---|---|---|---|
| `GET` | `/members` | | Query: `q` (name, phone, member ID), `status`, `unit`, `gender`, `eventId` plus `assignment=all|assigned|unassigned`, `sort` (`name`, `phone`, `unit`, `joinedYear`, `zone`), `dir`, `page`, `pageSize`. With `eventId`, each item also has `assignment?: { id, zoneId, zoneName, positionId, positionName, status, isTeamLead }` for that event. |
| `GET` | `/members/{id}` | | Member plus `assignments[]`, one per event (with event code, name and date, zone and position names), for the member drawer. |
| `POST` | `/members` | `addMember` | **409** `DUPLICATE_PHONE` with the existing member's id and name. |
| `PATCH` | `/members/{id}` | `updateMember` | Same duplicate check. |
| `DELETE` | `/members/{id}` | | Also removes their assignments. |
| `POST` | `/members/bulk-delete` | `deleteMembers` | `{ "memberIds": [...] }`. **200** `{ "deleted": 12 }`. |
| `GET` | `/members/check-phone?phone=` | | `{ "available": false, "member?": { id, name } }`. Used for live validation in the member form. |

---

## 9. Admin: assignments

| Method | Path | Store action | Notes |
|---|---|---|---|
| `GET` | `/events/{eventId}/assignments` | | Query: `q` (member name or phone), `zoneId`, `positionId`, `status`, `sort` (`member`, `zone`, `position`, `status`), `dir`, `page`, `pageSize`. Each item: Assignment plus `member: { id, firstName, lastName, phone }`, `zoneName`, `positionName`, `spot?`. |
| `POST` | `/events/{eventId}/assignments` | `assign` | Body `{ "memberId", "zoneId", "positionId", "isTeamLead?": false, "replace?": true }`. Follows the rules in §15.2–15.4. **201** `{ "assignment", "replaced?": { "previousOfMember?": Assignment, "displacedFromSpot?": { assignment, member } } }` so the UI can say what changed. |
| `PATCH` | `/assignments/{id}` | | `{ "zoneId?", "positionId?", "isTeamLead?", "status?" }`. Same rules. |
| `DELETE` | `/assignments/{id}` | `removeAssignment` | **204**. |
| `POST` | `/events/{eventId}/assignments/bulk` | `bulkAssign` | `{ "memberIds": [...], "zoneId", "positionId" }`. **200** `{ "assigned": 10, "skipped": [{ memberId, reason }] }`. For a spot position only one member may be sent (**422** otherwise). |
| `POST` | `/events/{eventId}/assignments/bulk-remove` | `removeAssignmentsFor` | `{ "memberIds": [...] }`. **200** `{ "removed": 10 }`. |
| `POST` | `/events/{eventId}/assignments/copy` | `moveToEvent` | `{ "toEventId", "memberIds?": [...] }`. Copies those members' assignments into the other event, matched by zone and position name. Members already assigned there are overwritten. **200** `{ "copied": 52, "unmatched": [...] }`. |
| `POST` | `/assignments/{id}/confirm` | `confirmAssignment` | Admin marks someone confirmed. |

---

## 10. Admin: venue map

The admin map shows staffing by section (badge colour) and every usher spot (filled or open). Tapping an open spot opens the assign dialog with that section and spot already chosen. Tapping a filled one shows the section's team.

### `GET /events/{eventId}/map`

```json
{
  "zones": [
    { "id": "z_s41", "name": "Section 41", "kind": "section", "mapRef": "S41", "stats": { "assigned": 4, "required": 4, "coverage": 100 } }
  ],
  "spots": [
    {
      "positionId": "p_s41_FL",
      "zoneId": "z_s41",
      "spot": "FL",
      "name": "Front row, left end",
      "occupant": { "assignmentId": "as_1", "memberId": "m_1", "firstName": "Daniel", "lastName": "Adeyemi", "status": "confirmed" }
    },
    { "positionId": "p_s41_FR", "zoneId": "z_s41", "spot": "FR", "name": "Front row, right end", "occupant": null }
  ]
}
```

* Include every zone of the event (zones without a `mapRef` too; the frontend lists them as "Outside the hall").
* `spots` has one entry per spot position, even when it is open (`occupant: null`).
* This and `GET /events/{eventId}/zones?include=positions,stats` together are all the map needs. To fill a spot, the frontend calls `POST /events/{eventId}/assignments` with that `positionId`.

---

## 11. Admin: dashboard, search, activity, notifications

| Method | Path | Notes |
|---|---|---|
| `GET` | `/events/{eventId}/overview` | Everything on the Overview page in one call: `{ event, stats: EventStats, zoneStats: [ZoneStat + name, kind, mapRef], activity: [latest 7 Activity] }`. The page also draws the compact map from `/events/{eventId}/map`. |
| `GET` | `/search?q=&eventId=` | Command palette (Ctrl/⌘ K). **200** `{ "members": [max 6, with their assignment in eventId], "zones": [max 6], "events": [max 4] }`. Match names, phone digits (partial, e.g. `0803`), member IDs, zone names ("Section 14", "Aisle 3", "E1"). |
| `GET` | `/activity?limit=60` | Newest first. Written by the server on every change listed in §15.7. |
| `GET` | `/notifications` | `{ "items": [Notification], "unread": 3 }`. |
| `POST` | `/notifications/read-all` | Marks all read. **204**. |
| `POST` | `/notifications/{id}/read` | **204**. |

Notifications the server should create on its own:

* An import completed, with counts of added, updated and skipped rows.
* Duplicate phone numbers found during an import.
* A roster was published.
* An event is 21 days away or less (send once).
* Unassigned members remain for the current event (at most once a day).

---

## 12. Admin: import

A 4-step flow on the Import page: upload, preview, validate, import.

### 12.1 `GET /imports/template?format=csv|xlsx`

Downloads a template with the columns `first_name, last_name, phone, email, gender, unit, zone, position`.

### 12.2 `POST /imports/preview` (multipart)

Fields: `file` (.csv, .xlsx or .xls, max 5 MB) and `eventId` (where zone and position columns get assigned).

Header matching is case- and punctuation-insensitive:

| Field | Accepted headers |
|---|---|
| `firstName` | first name, first, given name |
| `lastName` | last name, last, surname |
| `fullName` | name, full name (split into first and last when those columns are absent) |
| `phone` | phone, phone number, mobile, tel, telephone |
| `email` | email, email address |
| `gender` | gender, sex |
| `unit` | unit, team, team unit |
| `zone` | zone, aisle, zone aisle, area |
| `position` | position, role |

**200**
```json
{
  "importId": "imp_1",
  "fileName": "members-oct.csv",
  "columns": { "First Name": "firstName", "Phone": "phone", "Zone": "zone" },
  "rows": [
    { "row": 2, "data": { "firstName": "Tobi", "lastName": "Adeleke", "phone": "08135550101", "zone": "Aisle 3", "position": "Control 2" },
      "status": "new | update | error", "errors": [], "warnings": ["Zone not found: Aisle 11"], "existingMemberId?": "m_9" }
  ],
  "summary": { "total": 58, "new": 50, "update": 6, "error": 2 }
}
```

Row errors: missing name, missing or invalid phone, phone repeated within the file. Warnings: an unknown zone or position (the row imports without an assignment), or a spot position that is already taken.

### 12.3 `POST /imports/{importId}/commit`

Body `{ "updateExisting": true, "assign": true }`. **200** `{ "added": 50, "updated": 6, "skipped": 2, "assigned": 48 }`. Writes activity and a notification. Previews expire after one hour.

---

## 13. Admin: reports and exports

### `GET /events/{eventId}/exports/{kind}?format=csv|xlsx|pdf&zoneId=`

Returns a file with a `Content-Disposition` filename such as `TGA-2026-full-roster.csv`.

| `kind` | Rows | Columns |
|---|---|---|
| `full` | Every assignment, ordered by zone order then position order | Zone, Position, Spot, Member, Phone, Team Lead, Status |
| `aisle` | One zone (needs `zoneId`), for leads to print | Same as `full` |
| `unassigned` | Active members with no assignment in the event | Member, Phone, Email, Unit |
| `event` | Every assignment with the unit | Same as `full`, plus Unit |
| `contacts` | All members | Member, Phone, Email, Unit, Status |

The PDF should be a printable A4 table with the event name, date and reporting time in the header.

### `GET /events/{eventId}/reports/summary`

Feeds the health cards on the Reports page: `{ stats: EventStats, byKind: { aisle: {assigned, required}, section: {…}, door: {…}, area: {…} }, spots: { total: 320, filled: 276 }, lowestCoverage: [5 ZoneStat] }`.

---

## 14. Admin: settings

| Method | Path | Notes |
|---|---|---|
| `GET` | `/settings` | `Settings`. |
| `PATCH` | `/settings` | Partial `Settings`. Validate `contactPhone` as a Nigerian number. |
| `POST` | `/admin/reset-demo` | **Development only.** Reseeds the demo data. Must not exist in production. |

---

## 15. Business rules the server must enforce

The frontend applies these too, but the server is the source of truth.

### 15.1 Phone numbers
Strip everything but digits. `234XXXXXXXXXX` (13 digits) becomes `0XXXXXXXXXX`. A 10-digit number starting with 7, 8 or 9 gets a leading 0. A valid number matches `^0[789][01]\d{8}$` (11 digits, e.g. `0803…`, `0705…`, `0911…`). Store and compare only the normalised form.

### 15.2 One assignment per member per event
Assigning a member who already has an assignment in that event **replaces** it. Return the previous one in `replaced.previousOfMember`.

### 15.3 One usher per spot
A position with `spot` set holds one member. Assigning someone to an occupied spot moves the current occupant off it, which leaves them unassigned, and is returned in `replaced.displacedFromSpot`. If the request has `replace: false`, refuse with **409** `SPOT_TAKEN` instead. Spot positions always have `required = 1`, and only sections with spots (§3.2) may have spot positions.

### 15.4 One team lead per zone
Setting `isTeamLead: true` clears the flag from anyone else in that zone. Assigning someone to a position with `isLeadRole` sets `isTeamLead` by default.

### 15.5 Publishing controls visibility
While `rosterStatus` is `draft`, public endpoints return `unpublished` and no positions, and the public map endpoint returns **404**.

### 15.6 Unique map references
Within one event, a `mapRef` may belong to only one zone.

### 15.7 Activity log
Record an Activity on every one of these, with the admin's first name as `actor`:
* creating, editing, duplicating, archiving or deleting an event
* publishing or unpublishing a roster
* assigning, moving or removing people (one entry per bulk action, e.g. "assigned 12 ushers to Aisle 4")
* adding, editing or deleting members
* imports
* zone and position changes

### 15.8 Deleting cascades
Deleting an event removes its zones, positions and assignments. Deleting a zone removes its positions and assignments. Deleting a member removes their assignments.

### 15.9 Concurrency
Several admins may assign at once. Use a unique constraint on `(eventId, memberId)` for assignments, and a unique constraint on `positionId` for spot positions, so two admins can't fill the same spot. Return **409** on a lost race so the UI can refresh.

---

## 15a. Open questions for the backend developer

1. **Lookup privacy.** Today anyone who types a member's phone number sees that member's post and, if `showTeammatePhones` is on, their teammates' numbers. Consider a one-time code by SMS or WhatsApp before `POST /public/lookup` returns a `found` result (`POST /public/lookup/otp` then `POST /public/lookup` with `{ phone, code }`). The frontend can add the code step when the API supports it.
2. **Admin accounts.** Who creates admin users, and do we need the `editor` role from day one?
3. **One venue or many.** Events at other venues (e.g. Eagle Square) currently reuse the auditorium plan. If other venues need their own plans, add a `venueId` to Event and serve the plan per venue.

---

## 16. Endpoint index

**Public**
```
GET    /public/current-event
POST   /public/lookup
GET    /public/events/{eventId}/map
POST   /public/assignments/{assignmentId}/confirm
GET    /public/settings
```

**Auth**
```
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
POST   /auth/forgot-password
POST   /auth/reset-password
```

**Events**
```
GET    /events
POST   /events
GET    /events/{id}
PATCH  /events/{id}
DELETE /events/{id}
POST   /events/{id}/duplicate
POST   /events/{id}/archive
POST   /events/{id}/publish
POST   /events/{id}/unpublish
PUT    /settings/current-event
```

**Zones and positions**
```
GET    /events/{eventId}/zones?include=positions,stats
POST   /events/{eventId}/zones
PUT    /events/{eventId}/zones/order
POST   /events/{eventId}/zones/apply-template
PATCH  /zones/{zoneId}
DELETE /zones/{zoneId}
POST   /zones/{zoneId}/positions
PUT    /zones/{zoneId}/positions/order
PATCH  /positions/{positionId}
DELETE /positions/{positionId}
GET    /venue/template
```

**Members**
```
GET    /members
POST   /members
GET    /members/check-phone
GET    /members/{id}
PATCH  /members/{id}
DELETE /members/{id}
POST   /members/bulk-delete
```

**Assignments and map**
```
GET    /events/{eventId}/assignments
POST   /events/{eventId}/assignments
POST   /events/{eventId}/assignments/bulk
POST   /events/{eventId}/assignments/bulk-remove
POST   /events/{eventId}/assignments/copy
PATCH  /assignments/{id}
DELETE /assignments/{id}
POST   /assignments/{id}/confirm
GET    /events/{eventId}/map
```

**Dashboard, search, activity, notifications**
```
GET    /events/{eventId}/overview
GET    /search
GET    /activity
GET    /notifications
POST   /notifications/read-all
POST   /notifications/{id}/read
```

**Import, reports, settings**
```
GET    /imports/template
POST   /imports/preview
POST   /imports/{importId}/commit
GET    /events/{eventId}/exports/{kind}
GET    /events/{eventId}/reports/summary
GET    /settings
PATCH  /settings
POST   /admin/reset-demo        (development only)
```
