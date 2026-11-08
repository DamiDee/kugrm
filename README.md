# Global Roster Manager

Roster and assignment management for the Koinonia Global Ushering Department.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in dist/
npm run build:single # one self-contained file: dist-single/index.html
```

`dist-single/index.html` opens straight from disk by double-clicking it.

## Demo

The demo is set up for The General Assembly 2026 (TGA 2026), 18–22 November: 10 sessions, a morning and an evening each day. Days 1 and 2 are published; days 3 to 5 are drafts.

**Ushers** (no login): enter a phone number on the home page, then pick a session.

| Number | Shows |
| --- | --- |
| 0803 123 4567 | Daniel Adeyemi: Section 41 front row left on Day 1 morning, greeter at door X4 on Day 1 evening, no post on Day 2 evening. Try “I can't make it” on a session. |
| 0805 000 7788 | Grace Emmanuel, already marked as away for Day 1 morning |
| 0805 111 2233 | Member found, no assignment yet |
| 0809 999 0000 | Number not registered |

**Coordinators and leaders**: `/#/team/login`, by phone number (no code in the demo).

| Number | Shows |
| --- | --- |
| 0802 000 1122 | John Adewale, coordinator of Sections 40–43 |
| 0814 123 0008 | Michael Danladi, leader of the Nave B coordinators |

**Admins**: `/#/admin/login`, any email with a 4+ character password. The Team page sets up leaders and coordinators.

## What's inside

- React 19, TypeScript, Tailwind CSS, Framer Motion, Lucide icons, Zustand
- 1,284 generated members; each session has 123 zones and 386 positions
- Data is kept in the browser (localStorage, key `grm-store-v4`) until a backend is connected; Settings → Reset demo data restores it
- `src/data/venue.ts`: the arena floor plan (83 sections, aisles 1–9, doors D1–D9, X1–X5 and M1–M3, 312 usher seats); `src/components/venue/VenueMap.tsx` draws it. Zones link to it by `mapRef`, and positions with a `spot` are the four usher seats in a section
- `src/data/duties.ts`: duties (seat, crowd control, greeter, door, lead, protocol, support)
- `docs/API.md`: the backend API requirements
- `src/data/mock.ts`: demo data; `src/store/useStore.ts`: all roster actions
- shadcn-style components are written in `src/components/ui` (no CLI step needed)
