# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

Use **pnpm** exclusively. Never use npm or yarn — workspace linking will break.

## Commands

```bash
pnpm dev            # start all apps in dev mode
pnpm build          # build all packages
pnpm test           # run all tests
pnpm lint           # Biome lint check (read-only)
pnpm check          # Biome format + lint fix (entire repo)
pnpm db:migrate     # run Drizzle migrations
pnpm db:seed        # seed the database
```

Scope a command to one package:

```bash
pnpm --filter @propninja/api test -- <pattern>   # run a single test
pnpm --filter @propninja/web dev                 # web dev server only
```

## Code Style

**Biome 1.9.4** handles all formatting and linting — there is no ESLint or Prettier. Config is in `packages/config/biome.json`.

- 2-space indentation, 100-character line width
- Double quotes, always semicolons, trailing commas
- Non-null assertions (`!`) are allowed — `noNonNullAssertion` is off
- Imports are auto-sorted; run `pnpm check` after adding imports

## Environment Setup

Copy `.env.example` → `.env` in each workspace before running locally:

| Workspace        | Required vars                                      |
| ---------------- | -------------------------------------------------- |
| `apps/api`       | `DATABASE_URL`, `AUTH_JWT_SECRET` (min 16 chars)   |
| `apps/web`       | `NEXT_PUBLIC_API_URL`                              |
| `apps/mobile`    | `EXPO_PUBLIC_API_URL`                              |
| `packages/db`    | `DATABASE_URL`                                     |

**Demo mode:** Set `ALLOW_DEMO_AUTH=true` in `apps/api/.env` to log in without a real database (dev only).

## Testing

- **Vitest** — `api`, `web`, `types`, `ui`
- **Jest** — `mobile`
- API integration tests require a live PostgreSQL connection; they are skipped if `DATABASE_URL` is unset
- Single test: `pnpm --filter @propninja/api test -- <pattern>`

## Gotchas

- **Expo + pnpm:** `pnpm-workspace.yaml` sets `nodeLinker: hoisted` for Expo SDK 53 / Metro compatibility — do not change this.
- **Migrations:** Run `pnpm db:migrate` after pulling any schema changes from `packages/db`.
- **Workspace refs:** Cross-package dependencies use `workspace:*` (pnpm syntax) — do not change to version numbers.
- **Auth:** JWT is stored in localStorage (web/mobile) and a `propninja_session` cookie (Next.js middleware). Role-based access (admin/manager/agent) is enforced on the API side.
- **Deployments:** API → Railway, web → Vercel, mobile → EAS. See `DEPLOY.md` for procedures.

## Monorepo Layout

```
apps/api       Hono REST API (port 3001, Node.js + tsx)
apps/web       Next.js 14 back-office (port 3000)
apps/mobile    React Native / Expo field app
packages/db    Drizzle ORM schema + migrations (PostgreSQL 16)
packages/types Shared TypeScript types
packages/ui    Shared shadcn/ui components
packages/config Shared Biome + TypeScript configs
```

Subdirectory CLAUDE.md files can be added for module-specific instructions (loaded automatically when working in those directories).
