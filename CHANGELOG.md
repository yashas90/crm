# Changelog

All notable changes to PropNinja CRM are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-16

First production release of PropNinja CRM — a single-tenant real estate CRM for small sales teams.

### Added

#### Web dashboard
- JWT login with Next.js middleware session cookie gating
- Dashboard with pipeline, calls, hot leads, and team snapshot (manager/admin)
- Leads: search, advanced filters, scopes (my/team/unassigned/deleted/duplicate/re-enquired), CSV bulk import, bulk actions, notes, assignment, admin delete
- Lead detail: timeline, calls, tags, TCF consent panel, estimated value
- Projects: list, multi-step wizard, edit, delete, availability toggle
- Reports: dashboard, leads analytics, calls (filters + CSV export), team performance, lead sources
- Tasks: list, filters, bulk actions, slide-overs, dashboard widget
- Users management (admin)
- Settings: org profile, integrations status, audit log
- In-app notification bell
- Public `/status` page (API health, DB connectivity, deploy metadata)
- Security headers: CSP, `X-Frame-Options`, `X-Content-Type-Options`

#### Mobile app (Expo)
- JWT auth with SecureStore; 401 auto-logout
- Leads: infinite scroll, filters, create, detail with inline edit and notes
- Today queue: follow-ups due; SIM dial + manual call logging
- Tasks tab with detail sheet
- TCF call consent read/write; dial guard for “Do not call”
- Notifications inbox with unread badges
- Agent-scoped data with polling refresh
- EAS build profiles for preview and production

#### API (Hono + PostgreSQL)
- Auth: login, me, push token registration
- Leads: CRUD, notes, assign, soft-delete, duplicate-phone guard, bulk import, re-enquired scope
- Calls: log (mobile), list, summary
- Reports: overview, dashboard, leads/calls analytics, team-today, sources, CSV exports
- Projects CRUD with availability toggle
- Tasks: CRUD, bulk actions, notes, complete endpoint
- Users, org settings, user roles
- TCF per-channel consent with lead-scoped authorization
- Notifications and follow-up notification job
- Audit log (admin)
- Meta Lead Ads webhook ingest with signature verification
- Google Ads lead form polling job and manual poll endpoint
- Health endpoint: `{ status, version, timestamp, db }`
- Production CORS for ninjamarketing.in domains (no wildcards)
- Rate limiting: 100 req/min per IP (public), 500 req/min per authenticated user, `Retry-After` on 429
- Sentry error tracking with PII scrubbing

#### Data & tooling
- PostgreSQL schema via Drizzle ORM with migrations and demo seed
- Monorepo: pnpm workspaces + Turborepo
- Biome lint/format; Vitest tests (API, web, db, ui, mobile)
- GitHub Actions CI: Postgres, migrate, seed, `pnpm check:ci`
- Railway and Vercel deploy configs; Render blueprint alternative

### Security
- bcrypt password hashing; no public self-registration
- Per-request DB session check; inactive users rejected
- Role-based permissions (admin / manager / agent)
- Agent scoping enforced server-side on leads and calls
- JWT and sensitive fields scrubbed from Sentry payloads
- `docs/pre-launch-security.md` and `docs/LAUNCH_CHECKLIST.md`

### Known limitations
- Single-tenant only (one org per deployment)
- SIM dialer on mobile; no in-app VoIP
- Project gallery metadata only (no file upload)
- In-app notifications only (no email/SMS/push delivery in v1.0)
- Integrations configured via environment variables

[1.0.0]: https://github.com/yashas90/crm/releases/tag/v1.0.0
