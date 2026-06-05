# PropNinja CRM v1.0 — Release Notes

## Overview

PropNinja CRM v1.0 is the first complete internal release of a single-tenant real estate CRM for a small sales team. It ships three apps in one monorepo: a **web back-office** (Next.js), a **mobile agent app** (React Native + Expo), and a **Hono REST API** backed by PostgreSQL. v1.0 covers the core daily workflow—managing leads, logging SIM calls from mobile, role-based access, operational reports, and TCF consent visibility—without multi-tenant hosting or VoIP.

## Key capabilities

### Web
- Dashboard with pipeline, revenue, calls, hot leads, and team snapshot (manager/admin)
- Leads list with search, filters, create/edit/delete (delete: admin), notes, assignment
- Lead detail: contact info, timeline, calls, tags, TCF consent panel, estimated value
- Reports: dashboard, leads analytics, calls, team performance (manager/admin; agents see scoped views)
- Users page (admin can edit roles/active status)
- Settings (org display)
- Role-aware navigation and friendly 403 handling for agents
- JWT login; registration disabled (admin-provisioned users only)

### Mobile
- JWT auth with SecureStore; profile and logout
- Leads: list, create (with source/tags/follow-up), detail with inline edit
- Today queue: follow-ups due; tap for detail; Call and Log actions
- SIM outbound calling via device dialer; manual call logging after calls
- TCF compliance chip on lead detail; confirmation prompt before dialing “Do not call” leads
- Agent-scoped data (assigned leads, own calls)

### Backend & data
- PostgreSQL schema via Drizzle ORM; migrations and demo seed (~100 leads, calls, users, TCF)
- REST API: auth, leads, calls, users, org, reports, TCF
- Permission checks: admin / manager / agent on leads, reports, users, delete
- Agent scoping: list/filter forced to own assignments and own call history
- Reports: overview, dashboard, leads/calls analytics, team-today
- TCF: per-channel consent (call, SMS, email) read/write on web; read + dial guard on mobile

## Security & auth

- **JWT** — `AUTH_JWT_SECRET` required (min 16 characters); no fallback secret in production paths
- **Passwords** — bcrypt-hashed in DB; login against seeded/provisioned users only (no self-registration)
- **Permissions** — role checks on lead view/edit/assign/delete, reports, user management
- **Rate limiting** — applied on write endpoints (e.g. lead create/update, call log)
- **CORS** — configured for local web and Expo dev origins

## Known limitations

- **Single-tenant only** — one organization per deployment; no tenant isolation or SaaS multi-org model
- **No bulk import** — leads must be created manually (web/mobile); import UI shows a placeholder message
- **No in-app VoIP** — outbound calls use the device SIM via `tel:` links; web does not place calls
- **Mobile** — no TCF consent editing on mobile (display + dial confirmation only)
- **Registration** — disabled on web; new users require admin provisioning (no `POST` public signup)
- **Integration tests** — API tests expect a migrated, seeded Postgres (see CI setup below)

## How to log in

After `pnpm db:seed`, use:

| | |
|---|---|
| **Email** | `admin@propninja.local` |
| **Password** | `admin` |

Other seeded accounts (same password): `manager@demo.propninja`, `agent1@demo.propninja`, `agent2@demo.propninja`, `agent3@demo.propninja`.

Web: http://localhost:3000 · Mobile: Expo app with `EXPO_PUBLIC_API_URL` pointing at the API.

## How to run tests and CI

**Full pipeline (lint + test + build):**

```bash
pnpm db:migrate && pnpm db:seed && pnpm check:ci
```

`check:ci` runs Turborepo `lint`, `test`, and `build` across api, web, db, and other workspaces.

**Individual commands:**

```bash
pnpm lint    # Biome per package
pnpm test    # Vitest (api, web, db)
pnpm build   # api (tsc), web (next build)
```

**CI** — GitHub Actions workflow `.github/workflows/ci.yml` runs on every push and PR: Postgres 16 service, `pnpm install --frozen-lockfile`, migrate, seed, then `pnpm check:ci`.

Required env for API/tests: `DATABASE_URL`, `AUTH_JWT_SECRET` (see `apps/api/.env.example`).
