# PropNinja CRM v1.0 — Release Notes

## Overview

PropNinja CRM v1.0 is a single-tenant real estate CRM for a small sales team. The monorepo ships a **web back-office** (Next.js), a **mobile agent app** (React Native + Expo), and a **Hono REST API** on PostgreSQL. Core workflow: leads pipeline, CSV bulk import, SIM call logging from mobile, role-based access, operational reports, TCF consent, and ad-lead ingest (Meta / Google when configured).

## Key capabilities

### Web
- Dashboard with pipeline, calls, hot leads, and team snapshot (manager/admin)
- Leads list with search, filters, scopes (my/team/unassigned/deleted/duplicate/re-enquired), page sizes 10–500, **CSV bulk import**, bulk actions, create/edit/delete (delete: admin), notes, assignment
- Lead detail: contact info, timeline, calls, tags, TCF consent panel, estimated value
- Projects: list, wizard (basic/units/blocks/amenities; gallery metadata only), edit, delete, availability toggle
- Reports: dashboard, leads analytics, calls (filters + CSV export), team performance, lead sources
- Users page (admin can edit roles/active status)
- Settings: org profile edit (`PATCH /api/org`), regional defaults (locale/currency/timezone), report emails, lead scoring, integrations status, audit log
- In-app notification bell
- Role-aware navigation and 403 handling for agents
- JWT login; registration disabled (admin-provisioned users only)

### Mobile
- JWT auth with SecureStore; profile and logout; 401 auto-logout
- Leads: infinite scroll, filters, create (source/tags/follow-up), detail with inline edit and notes
- Today queue: follow-ups due; Call and Log actions; log sheet after returning from dialer
- SIM outbound calling via device dialer; manual call logging
- TCF: call consent read/write on lead detail; SMS/email read-only; dial guard for “Do not call”
- Notifications inbox with unread badges; tap to mark read and open related lead
- Agent-scoped data (assigned leads, own calls); ~30s polling refresh

### Backend & data
- PostgreSQL schema via Drizzle ORM; migrations and demo seed (~100 leads, calls, users, TCF, projects)
- REST API: auth, leads (incl. bulk import), calls, users, org (`GET` / `PATCH`), reports, TCF, projects, notifications, audit logs, integrations
- Permission checks: admin / manager / agent on leads, reports, users, TCF (lead-scoped), delete
- Agent scoping: list/filter forced to own assignments; recent activities scoped for agents
- Reports: overview, dashboard, leads/calls analytics, sources, team-today, CSV export
- TCF: per-channel consent read/write; authorization on all TCF routes
- Ad leads: Meta webhook + Google Ads polling when env vars are set

## Security & auth

- **JWT** — `AUTH_JWT_SECRET` required (min 16 characters)
- **DB session check** — API middleware loads the user on each request; `isActive: false` returns 401 immediately
- **Web route gating** — Next.js middleware checks a lightweight `propninja_session` cookie (set on login); JWT remains in localStorage for API calls
- **Passwords** — bcrypt-hashed; login against seeded/provisioned users only (no self-registration)
- **Permissions** — role checks on lead view/edit/assign/delete, reports, user management, TCF per lead
- **Rate limiting** — write endpoints (lead create/update, call log, etc.)
- **CORS** — configured for web and Expo dev origins

Note: `ALLOW_DEMO_AUTH` appears in deploy docs/env schema but is **not enforced** in auth code today.

## Known limitations

- **Single-tenant only** — one organization per deployment
- **No in-app VoIP** — outbound calls use the device SIM via `tel:`; web does not place calls
- **Project gallery** — no file upload/storage; placeholder metadata in wizard only
- **Registration** — disabled on web; new users require admin provisioning
- **Integrations UI** — status/read-only; credentials configured via API env vars ([INTEGRATIONS.md](INTEGRATIONS.md))
- **Mobile** — no reports/team dashboard; no lead assign/delete UI; SMS/email TCF not editable on mobile
- **Tests** — see below

## How to log in

After `pnpm db:seed`, use:

| | |
|---|---|
| **Email** | `admin@propninja.local` |
| **Password** | `admin` |

Other seeded accounts (same password): `manager@demo.propninja`, `agent1@demo.propninja`, `agent2@demo.propninja`, `agent3@demo.propninja`.

Web: http://localhost:3000 · Mobile: Expo with `EXPO_PUBLIC_API_URL` pointing at the API.

Change the seeded admin password before production use if the demo seed was applied to a live database.

## How to run tests and CI

**Full pipeline (lint + test + build):**

```bash
pnpm db:migrate && pnpm db:seed && pnpm check:ci
```

`check:ci` runs Turborepo `lint`, `test`, and `build` across workspaces.

**What actually runs tests:**

| Workspace | Tests |
|-----------|--------|
| `@propninja/api` | Vitest — unit tests + integration tests (Postgres required; skipped if DB unreachable) |
| `@propninja/web` | Vitest — component and lib unit tests |
| `@propninja/db` | Vitest |
| `@propninja/mobile` | Stub script (`echo "No tests yet"`) — passes CI without running tests |
| `@propninja/types`, `@propninja/ui` | Same stub |

CI does **not** run Expo/mobile builds or E2E tests.

**Individual commands:**

```bash
pnpm lint    # Biome per package
pnpm test    # turbo test
pnpm build   # api (tsc), web (next build)
```

**CI** — `.github/workflows/ci.yml`: Postgres 16 → install → migrate → seed → `pnpm check:ci`.

Required env for API/tests: `DATABASE_URL`, `AUTH_JWT_SECRET` (see `apps/api/.env.example`).
