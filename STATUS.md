# PropNinja CRM — Project Status

High-level snapshot of what v1.0 delivers, what is explicitly out of scope, and sensible extension paths. For setup and commands, see [README.md](README.md). For the v1.0 release summary, see [RELEASE_NOTES.md](RELEASE_NOTES.md).

---

## A. Implemented

### Backend / API
- JWT auth (`POST /api/auth/login`, `GET /api/auth/me`); bcrypt passwords; `AUTH_JWT_SECRET` required
- **Session enforcement** — each request re-loads the user from DB; inactive users get 401 even with a valid JWT
- Role permissions: admin, manager, agent — leads, reports, users, delete, assign
- Agent scoping on lead lists, call queries, and recent-activity feed (server-enforced)
- Leads: CRUD, notes, assign, soft-delete (admin), duplicate-phone guard, **bulk CSV import** (`POST /api/leads/bulk-import`, merge on duplicate phone), re-enquired scope (activity-based filter)
- Calls: list/summary (web); `POST /api/calls/log` (mobile)
- Reports: overview, dashboard, leads/calls analytics, per-user calls report, CSV export, team-today, lead sources
- **Projects** — CRUD, availability toggle (manager/admin)
- **Notifications** — in-app list + mark-read; follow-up job creates notifications
- **Audit log** — admin list (`GET /api/audit-logs`)
- TCF: per-channel consent; routes enforce lead view/edit permissions
- **Integrations** — Meta Lead Ads webhook ingest, Google Ads polling job, `GET /api/integrations/status`
- Users & org endpoints (`GET` / `PATCH /api/org` with `org_profile:update`); write rate limiting on sensitive routes
- Hono + Zod validation; Vitest unit + integration tests (integration tests need Postgres)

### Web
- Auth: login (demo prefill in dev only), disabled registration, **HttpOnly JWT cookie** + `propninja_session` middleware, client session guard in dashboard shell
- Dashboard: manager/admin overview; agent-specific home
- Leads: list, filters, scopes (including duplicate / re-enquired), page sizes 10–500, **CSV bulk import**, bulk status/assign/archive, create, edit, detail, delete (admin)
- **Projects** — list, wizard, edit, delete, availability
- Reports hub + leads/calls/team pages; calls report with filters, export, pagination; 403 access-denied UX
- Users (admin edits); settings (org profile + regional defaults, report emails, lead scoring, integrations status, audit log)
- In-app notification bell
- TCF consent panel on lead detail (call/SMS/email)
- TanStack Query + shared API client; Vitest component/unit tests

### Mobile
- JWT auth (SecureStore), profile, logout; 401 clears session
- Leads: infinite scroll, filters, create, detail with edit modal + notes
- Today queue: follow-ups due; Call + Log; post-call logging modal; auto-open log sheet after SIM dial
- SIM dial via `tel:`; TCF chip + “Do not call” confirmation before dial
- **TCF call consent write** on lead detail (`POST /api/tcf/consent`, `source: mobile_app`); SMS/email read-only
- **Notifications inbox** — list, unread badge (Home + Alerts tab), mark-read, navigate to lead
- Live data refresh (~30s polling); agent-scoped leads and calls via API
- EAS build config for Android/iOS (see `DEPLOY.md`, `EAS_SETUP.md`)

### DB / schema / tooling
- PostgreSQL + Drizzle: org, users, leads, calls, activities, TCF, projects, notifications, audit logs, ad leads, migrations
- Demo seed: users, projects, ~100 leads, call history, consent records
- Monorepo: pnpm + Turborepo; Biome lint/format
- `pnpm check:ci` — lint, test, build across workspaces
- GitHub Actions CI: Postgres 16, migrate, seed, full check pipeline

---

## B. Non-goals / deferred

These are **not** planned for v1.0 and should not be assumed available:

| Area | Status |
|------|--------|
| Multi-tenant | Single org per deployment only |
| Billing / plans | No subscriptions, invoicing, or usage metering |
| In-app calling (VoIP) | SIM dialer + manual log only; no WebRTC/telephony SDK |
| Advanced analytics / ML | Operational reports only; no forecasting, scoring, or ML pipelines |
| Project gallery files | Wizard step stores placeholder metadata only; no blob upload |
| Push / email / SMS notifications | In-app notifications only; optional daily/weekly report emails to managers/admins |
| Mobile manager reports | No reports screens on mobile |

Also deferred: public self-registration, mobile SMS/email TCF editing, native Android call-log auto-sync, user hard-delete API, OAuth connect UI for integrations (env-only config today).

---

## C. How to extend

Natural directions if the product grows beyond a single-team deployment:

1. **Multi-org / multi-tenant** — `org_id` scoping already exists in schema; add tenant resolution, isolated admin, and per-org billing boundaries before opening signup.
2. **Billing & plans** — subscription tiers tied to `organizations.subscription_tier`; gate features (users, leads volume, reports) via middleware or feature flags.
3. **Project gallery storage** — S3/R2 upload endpoint + real image URLs in project wizard.
4. **Android call-log sync** — background listener to auto-post `POST /api/calls/log` with disposition inference; requires device permissions and matching rules to leads by phone.
5. **Deeper compliance** — audit log for TCF changes, export for regulators, optional hard block (no override) on “Do not call” for regulated markets.

Each extension should preserve existing permission boundaries and API shapes where possible; add migrations and CI coverage before shipping.
