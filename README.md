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

**Ushers** (no login): enter a phone number on the home page.

| Number | Shows |
| --- | --- |
| 0803 123 4567 | Daniel Adeyemi, TGA 2026, Section 41, front row left end, with teammates and his spot on the map |
| 0805 111 2233 | Member found, no assignment yet |
| 0809 999 0000 | Number not registered |

Unpublish the TGA 2026 roster in the admin to see “Roster coming soon”.

**Admins**: `/#/admin/login`, any email with a 4+ character password.

## What's inside

- React 19, TypeScript, Tailwind CSS, Framer Motion, Lucide icons, Zustand
- 1,284 generated members, 4 events, 119 zones / 377 positions per event, 920 assigned for TGA 2026
- Data is kept in the browser (localStorage) until a backend is connected; Settings → Reset demo data restores it
- `src/data/venue.ts`: the auditorium floor plan (90 sections, aisles 1–6, doors, usher spots); `src/components/venue/VenueMap.tsx` draws it. Zones link to it by `mapRef`, and positions with a `spot` are the four usher spots in a section
- `docs/API.md`: the backend API requirements
- `src/data/mock.ts`: demo data; `src/store/useStore.ts`: all roster actions
- shadcn-style components are written in `src/components/ui` (no CLI step needed)
