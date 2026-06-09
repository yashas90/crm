# PropNinja CRM

Single-tenant real estate CRM for a small sales team: **web back-office**, **mobile field app**, and a shared **REST API**. One organization, role-based access (admin / manager / agent), leads pipeline, call logging from the device SIM, reports, and TCF consent tracking.

## Stack

| Layer | Tech |
|-------|------|
| Web | Next.js 14, React, TanStack Query, shadcn/ui, Tailwind |
| Mobile | React Native, Expo, React Navigation |
| API | Hono (Node), Zod validation |
| Data | PostgreSQL, Drizzle ORM (`packages/db`) |
| Auth | JWT (`AUTH_JWT_SECRET`), bcrypt passwords, `GET /api/auth/me` |
| Tooling | pnpm workspaces, Turborepo, Biome, Vitest |

## Monorepo layout

```
apps/
  web/      Back-office dashboard (port 3000)
  api/      REST API (port 3001)
  mobile/   Agent app — SIM dial + call log (Expo)
packages/
  db/       Schema, migrations, seed
  ui/       Shared web UI primitives
  types/    Shared TypeScript types
  config/   tsconfig & Biome config
```

## Features

### Web (`apps/web`)
- **Leads** — list, search/filter, create, edit, delete (admin), notes, tags, assignment
- **Ad leads** — “Ad Leads” quick filter, Facebook/Google source presets, ad-lead detail panel (campaign, form, external ID)
- **Lead detail** — contact info, timeline, calls, TCF consent panel, estimated value
- **Reports** — dashboard (including **Leads from Source** via `/api/reports/sources`), leads analytics, **Leads – Call Report** (per-user tabular calls with filters, export, pagination), team performance (manager/admin)
- **Users** — team list; role/active edits (admin)
- **Settings** — org display; **Integrations** status (Meta + Google Ads)
- **TCF** — view and update call/SMS/email consent per lead
- Role-aware nav and graceful 403 handling for agents

### Mobile (`apps/mobile`)
- **SIM calling** — opens device dialer; logs calls via API after the call
- **Leads** — assigned leads, create lead, detail with edit + notes
- **Today queue** — follow-ups due today; tap card for detail, Call / Log actions
- **TCF** — compliance chip before dial (“OK to call” / “Do not call” / unknown)
- JWT auth stored in SecureStore; profile + logout

### API (`apps/api`)
- **Auth** — DB login, JWT issue/verify, `/api/auth/me`
- **Permissions** — admin / manager / agent scoping on leads, reports, users
- **Leads & calls** — CRUD, notes, assign; mobile-only `POST /api/calls/log`
- **Ad lead ingest** — Meta Lead Ads webhook (`/api/integrations/meta/webhook`), Google Ads polling job, dedup + tagging
- **Reports** — overview, sources, dashboard, leads/calls analytics (`ad_leads` filter), team-today
- **Integrations** — `GET /api/integrations/status` (sync health, webhook signature, scoping)
- **TCF** — consent read/write per channel
- **Users** — list and admin patch

## Local development

### Prerequisites

- **Node.js** — LTS 18 or 20
- **pnpm** — installed globally (`npm install -g pnpm` or `corepack enable`)
- **PostgreSQL 16** — local install or Docker:

```bash
docker run --name propninja-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=propninja \
  -p 5432:5432 -d postgres:16
```

Set connection and auth secrets in your shell or `.env` files (API requires `AUTH_JWT_SECRET`, min 16 characters):

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/propninja
export AUTH_JWT_SECRET=some-long-random-secret
```

Or copy app examples and edit:

```bash
cp apps/api/.env.example apps/api/.env
cp packages/db/.env.example packages/db/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

### Install, migrate, seed

From repo root:

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
```

Seed loads demo org, users, ~100 leads, call history, and TCF records. Admin login after seed:

| Email | Password |
|-------|----------|
| `admin@propninja.local` | `admin` |

### Run API, web, and mobile

All at once:

```bash
pnpm dev
```

Or in separate terminals:

```bash
pnpm --filter @propninja/api dev      # http://localhost:3001
pnpm --filter @propninja/web dev      # http://localhost:3000
pnpm --filter @propninja/mobile dev   # Expo dev server — see apps/mobile/MOBILE.md
```

Web and mobile API URLs are configured via env vars (`NEXT_PUBLIC_API_URL` / `EXPO_PUBLIC_API_URL`). See [apps/mobile/MOBILE.md](apps/mobile/MOBILE.md) for iOS vs Android dev URLs and EAS builds.

## Testing & CI

Run lint, tests, and production builds for all workspaces:

```bash
pnpm check:ci
```

With a fresh DB (matches CI):

```bash
pnpm db:migrate && pnpm db:seed && pnpm check:ci
```

Other useful commands:

```bash
pnpm lint          # turbo lint (Biome per package)
pnpm test          # turbo test (Vitest: api, web, db)
pnpm build         # turbo build (api tsc, web next build)
pnpm check         # Biome format + lint with auto-fix (root)
```

**GitHub Actions** — `.github/workflows/ci.yml` runs on every push and PR: Postgres service → `pnpm install` → migrate → seed → `pnpm check:ci`.

## Other seeded users

Same password (`admin`) for role testing:

| Email | Role |
|-------|------|
| `manager@demo.propninja` | manager |
| `agent1@demo.propninja` | agent |
| `agent2@demo.propninja` | agent |
| `agent3@demo.propninja` | agent |

Use different roles to verify permissions (e.g. agents see only assigned leads; managers see reports; admins manage users).

## Ad lead integrations

Facebook / Instagram Lead Ads (webhook) and Google Ads lead forms (polling) can push leads into the CRM. Setup steps and env vars are documented in [INTEGRATIONS.md](INTEGRATIONS.md).
