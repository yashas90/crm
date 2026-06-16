# PropNinja CRM

Single-tenant real estate CRM for a small sales team: **web back-office**, **mobile field app**, and a shared **REST API**. One organization, role-based access (admin / manager / agent), leads pipeline, call logging from the device SIM, reports, and TCF consent tracking.

## Stack

| Layer | Tech |
|-------|------|
| Web | Next.js 14, React, TanStack Query, shadcn/ui, Tailwind |
| Mobile | React Native, Expo, React Navigation |
| API | Hono (Node), Zod validation |
| Data | PostgreSQL, Drizzle ORM (`packages/db`) |
| Auth | JWT (`AUTH_JWT_SECRET`), bcrypt passwords; API re-validates user on each request; web uses localStorage + session cookie middleware |
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
- **Leads** — list, search/filter, scopes (my/team/unassigned/deleted/duplicate/re-enquired), page sizes 10–500, **CSV bulk import**, bulk actions, create, edit, delete (admin), notes, tags, assignment
- **Ad leads** — “Ad Leads” quick filter, Facebook/Google source presets, ad-lead detail panel (campaign, form, external ID)
- **Lead detail** — contact info, timeline, calls, TCF consent panel, estimated value
- **Projects** — list, wizard, edit, delete, availability toggle (gallery step is metadata-only; no file upload)
- **Reports** — dashboard (including **Leads from Source** via `/api/reports/sources`), leads analytics, **Leads – Call Report** (per-user tabular calls with filters, export, pagination), team performance (manager/admin)
- **Users** — team list; role/active edits (admin)
- **Settings** — org display (read-only); **Integrations** status (Meta + Google Ads); audit log
- **Notifications** — in-app bell, mark-read
- **TCF** — view and update call/SMS/email consent per lead
- Auth: JWT in localStorage; Next.js middleware checks `propninja_session` cookie on dashboard routes
- Role-aware nav and graceful 403 handling for agents

### Mobile (`apps/mobile`)
- **SIM calling** — opens device dialer; logs calls via API after the call; auto-prompt log sheet on return
- **Leads** — infinite scroll, filters, assigned leads, create lead, detail with edit + notes
- **Today queue** — follow-ups due today; tap card for detail, Call / Log actions
- **TCF** — call consent read/write on lead detail; SMS/email read-only; dial guard before “Do not call”
- **Notifications** — inbox tab with unread badge; mark-read; navigate to lead from payload
- JWT auth stored in SecureStore; 401 logout; profile + logout; ~30s polling refresh
- EAS build support — see [DEPLOY.md](DEPLOY.md) and [EAS_SETUP.md](EAS_SETUP.md)

### API (`apps/api`)
- **Auth** — DB login, JWT issue/verify, `/api/auth/me`; inactive users rejected on every request
- **Permissions** — admin / manager / agent scoping on leads, reports, users, TCF (per lead)
- **Leads & calls** — CRUD, notes, assign, **bulk import**; mobile `POST /api/calls/log`
- **Projects, notifications, audit logs** — CRUD or list endpoints as applicable
- **Ad lead ingest** — Meta Lead Ads webhook (`/api/integrations/meta/webhook`), Google Ads polling job, dedup + tagging
- **Reports** — overview, sources, dashboard, leads/calls analytics (`ad_leads` filter), team-today, CSV export
- **Integrations** — `GET /api/integrations/status` (sync health, webhook signature, scoping); credentials via env ([INTEGRATIONS.md](INTEGRATIONS.md))
- **TCF** — consent read/write per channel; lead authorization on all routes
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

### Error tracking (optional)

Sentry is disabled by default. When a DSN is set, unhandled API errors and client React errors are reported with `userId` and `role` tags when a user is authenticated. JWTs, passwords, and phone numbers are scrubbed before upload.

| App | Env var | Where to set |
|-----|---------|--------------|
| API (`apps/api`) | `SENTRY_DSN` | Railway / `apps/api/.env` |
| API release | `RAILWAY_GIT_COMMIT_SHA` | Set automatically on Railway deploys |
| Web (`apps/web`) | `SENTRY_DSN_WEB` | Vercel / `apps/web/.env.local` |
| Web source maps | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Vercel build env (optional) |

For production web deploys, set `SENTRY_DSN_WEB` in Vercel before build — it is inlined as `NEXT_PUBLIC_SENTRY_DSN_WEB` for the browser SDK.

**Verify setup (admin):** call `GET /api/sentry-test` on the web app with `Authorization: Bearer <admin-jwt>`.

Leave DSN vars unset locally; the app runs normally without Sentry.

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
pnpm test          # turbo test
pnpm build         # turbo build (api tsc, web next build)
pnpm check         # Biome format + lint with auto-fix (root)
```

**Test coverage notes:**
- **API** — Vitest unit tests plus integration tests against Postgres (skipped locally if DB unavailable)
- **Web / db** — Vitest unit/component tests
- **Mobile, types, ui** — stub `"No tests yet"` scripts (CI passes without mobile tests)
- CI does not run Expo builds or E2E tests

**GitHub Actions** — `.github/workflows/ci.yml` runs on every push and PR: Postgres 16 service → `pnpm install` → migrate → seed → `pnpm check:ci`.

## Production deploy

API on **Railway** (or **Render** via `render.yaml`), web on **Vercel**. Full setup, env vars, and redeploy steps: [DEPLOY.md](DEPLOY.md).

**Pre-launch security:** [docs/pre-launch-security.md](docs/pre-launch-security.md)

**Launch checklist:** [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md)

## First deploy checklist

After the first production deploy and `pnpm db:seed`, the database contains a default admin account (`admin@propninja.local` / `admin`). **Rotate these credentials before going live.**

### Reset admin credentials

From the repo root, with `DATABASE_URL` pointing at your production Postgres:

```bash
export DATABASE_URL="postgres://..."   # Railway internal or public URL
export NEW_ADMIN_EMAIL="you@yourcompany.com"
export NEW_ADMIN_PASSWORD="your-strong-password-here"

pnpm reset:admin
```

**On Railway** (uses the linked service `DATABASE_URL` automatically):

```bash
railway link
railway run bash -c 'NEW_ADMIN_EMAIL=you@yourcompany.com NEW_ADMIN_PASSWORD=your-strong-password-here pnpm reset:admin'
```

Or set `NEW_ADMIN_EMAIL` and `NEW_ADMIN_PASSWORD` in the Railway service variables, then run `railway run pnpm reset:admin`.

The script finds the seeded admin user (fixed seed ID or `admin@propninja.local`), bcrypt-hashes the new password (12 rounds, matching the API), updates the email, and prints success or a clear error. It never logs the password.

Requirements:

- `NEW_ADMIN_PASSWORD` — at least 6 characters (use 16+ in production)
- `NEW_ADMIN_EMAIL` — must not already belong to another user

Then sign in on the web dashboard with the new credentials and confirm other seeded demo users (`manager@demo.propninja`, etc.) are deactivated or given new passwords if needed.

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

## User playbook

Day-to-day guides for admins, agents, and managers: [PLAYBOOK.md](PLAYBOOK.md).
