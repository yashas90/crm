# AGENTS.md

General development guidance for this repo lives in [`CLAUDE.md`](CLAUDE.md) (package manager, commands, code style, monorepo layout, gotchas). Read it first — the section below only adds Cursor Cloud specific caveats.

## Cursor Cloud specific instructions

This is the PropNinja CRM monorepo (`apps/api` Hono REST API on port 3001, `apps/web` Next.js back-office on port 3000, `apps/mobile` Expo app, plus shared `packages/*`). The minimum end-to-end stack is PostgreSQL + API + Web. Redis and all third-party integrations (Meta, Google Ads, Twilio, WhatsApp, R2, Resend, Sentry) are optional and degrade gracefully with no keys.

### Environment already provisioned by the base snapshot
- Node and `pnpm@9.15.9` are installed; `pnpm install` (the update script) refreshes workspace deps.
- **PostgreSQL 16** is installed locally (Ubuntu apt cluster), with role `postgres`/`postgres` and a `propninja` database already migrated and seeded.
- Per-workspace env files are already on disk (gitignored, not committed): `apps/api/.env`, `packages/db/.env`, `apps/web/.env.local`, `apps/mobile/.env`. The API `.env` contains a generated `AUTH_JWT_SECRET` and `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/propninja`. If any are missing, recreate them from the matching `.env.example`.

### Starting services (Postgres does NOT auto-start on boot)
- Start the database first every session: `sudo pg_ctlcluster 16 main start` (check with `pg_lsclusters`). Nothing else works until it is `online`.
- Then run the dev servers (see `CLAUDE.md` / `README.md`): `pnpm --filter @propninja/api dev` (port 3001) and `pnpm --filter @propninja/web dev` (port 3000). The web app gates routes behind auth — unauthenticated requests to `/` return a 307 redirect to `/login`; that is expected, not an error.
- Seeded logins (all password `admin`): `admin@propninja.local` (admin), `manager@demo.propninja`, `agent1@demo.propninja`.

### Re-seeding caveat
- `pnpm db:seed` is **not idempotent against an already-seeded DB**: `clearDemoOrg` in `packages/db/src/seed.ts` deletes `users` without first deleting `message_templates` (which FK-reference users), so a second in-place seed throws a foreign-key error. To re-seed cleanly, drop and recreate the database first:
  `psql -h localhost -U postgres -c "DROP DATABASE propninja;" && psql -h localhost -U postgres -c "CREATE DATABASE propninja OWNER postgres;" && pnpm db:migrate && pnpm db:seed` (prefix with `PGPASSWORD=postgres`).

### Known pre-existing failures (not environment issues — do not chase during setup)
- `pnpm lint` fails only in `@propninja/mobile` (`biome check .`): one formatter diff in `apps/mobile/src/components/ui/Skeleton.tsx` plus `useExhaustiveDependencies` warnings. All other packages lint clean.
- `pnpm test` has a few pre-existing failures that surface **because the DB is reachable** (they skip when `DATABASE_URL` is unset): `packages/db/src/seed.test.ts` (re-seed FK bug above) and `apps/api/src/__tests__/lastAdmin.test.ts` (an admin-deactivation test blocklists the shared admin JWT, so a later test in the file reusing that token gets 401 — a test-ordering dependency). The rest of the ~500 API tests pass.

### Mobile app
- `apps/mobile` (Expo/React Native) needs an Android emulator or iOS simulator, which are not available in the cloud VM. Its Metro dev server (`pnpm --filter @propninja/mobile dev`) can start, but end-to-end GUI testing of the mobile app is out of scope here. Use the web app for end-to-end verification.
