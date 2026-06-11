# PropNinja CRM — Project Status

High-level snapshot of what v1.0 delivers, what is explicitly out of scope, and sensible extension paths. For setup and commands, see [README.md](README.md). For the v1.0 release summary, see [RELEASE_NOTES.md](RELEASE_NOTES.md).

---

## A. Implemented

### Backend / API
- JWT auth (login, `/api/auth/me`), bcrypt passwords, required `AUTH_JWT_SECRET`
- Role permissions: admin, manager, agent — leads, reports, users, delete, assign
- Agent scoping on lead lists and call queries (server-enforced)
- Leads: CRUD, notes, assign, soft-delete (admin), duplicate-phone guard
- Calls: list/summary (web); `POST /api/calls/log` (mobile only)
- Reports: overview, dashboard, leads/calls analytics, per-user calls report (`group_by=user`), CSV export (`/calls/export`), team-today
- TCF: per-channel consent (call, SMS, email)
- Users & org endpoints; write rate limiting on sensitive routes
- Hono + Zod validation; Vitest integration tests (DB-dependent)
- Optional Sentry error tracking (API + web) when `SENTRY_DSN` / `SENTRY_DSN_WEB` are configured

### Web
- Auth: login, disabled registration, session refresh, role-aware sidebar
- Dashboard: manager/admin overview; agent-specific home
- Leads: list, filters, create, edit-from-list, detail, delete (admin)
- Reports hub + leads/calls/team pages; **Leads – Call Report** (`/reports/calls`) — per-user metrics table, advanced filters, CSV export, server pagination; 403 access-denied UX
- Users (admin edits); settings (org)
- TCF consent panel on lead detail
- TanStack Query + shared API client; minimal Vitest component tests

### Mobile
- JWT auth (SecureStore), profile, logout
- Leads: list, create (extended fields), detail with edit modal
- Today queue: tappable cards, Call + Log, post-call logging modal
- SIM dial via `tel:`; TCF chip + “Do not call” confirmation before dial
- Agent-scoped leads and calls via API

### DB / schema / tooling
- PostgreSQL + Drizzle: org, users, leads, calls, activities, TCF, migrations
- Demo seed: users, ~100 leads, call history, consent records
- Monorepo: pnpm + Turborepo; Biome lint/format
- `pnpm check:ci` — lint, test, build across workspaces
- GitHub Actions CI: Postgres, migrate, seed, full check pipeline

---

## B. Non-goals / deferred

These are **not** planned for v1.0 and should not be assumed available:

| Area | Status |
|------|--------|
| Multi-tenant | Single org per deployment only |
| Billing / plans | No subscriptions, invoicing, or usage metering |
| Bulk import | UI placeholder only; no CSV/upload pipeline |
| In-app calling (VoIP) | SIM dialer + manual log only; no WebRTC/telephony SDK |
| Advanced analytics / ML | Operational reports only; no forecasting, scoring, or ML pipelines |

Also deferred: public self-registration, mobile TCF editing, native Android call-log auto-sync, backup runbooks beyond basic CI and optional Sentry.

---

## C. How to extend

Natural directions if the product grows beyond a single-team deployment:

1. **Multi-org / multi-tenant** — `org_id` scoping already exists in schema; add tenant resolution, isolated admin, and per-org billing boundaries before opening signup.
2. **Billing & plans** — subscription tiers tied to `organizations.subscription_tier`; gate features (users, leads volume, reports) via middleware or feature flags.
3. **Bulk import** — CSV upload endpoint + mapping UI on web; validate phones, dedupe, async job queue for large files.
4. **Android call-log sync** — background listener to auto-post `POST /api/calls/log` with disposition inference; requires device permissions and matching rules to leads by phone.
5. **Deeper compliance** — audit log for TCF changes, export for regulators, optional hard block (no override) on “Do not call” for regulated markets.

Each extension should preserve existing permission boundaries and API shapes where possible; add migrations and CI coverage before shipping.
