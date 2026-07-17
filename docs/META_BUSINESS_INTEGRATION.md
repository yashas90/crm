# Meta Business Integration

PropNinja integrates with Meta (Facebook / Instagram) using **official Graph API** only — no Zapier/Make/Pabbly.

## What you get

- Lead Ads webhooks (`POST /api/integrations/meta/webhook`) with HMAC verification
- Optional Meta Login OAuth to sync Business Manager assets into Postgres
- Multi page / form / pixel / ad account storage (`facebook_*` tables)
- BullMQ durable lead ingest when `REDIS_URL` is set
- Conversion API (CAPI) on CRM lead status changes when `META_CAPI_ENABLED=true`
- Campaign / insights sync jobs
- Admin UI at **Settings → Integrations → Meta**

## Quick start

1. Run migration: `pnpm db:migrate`
2. Set env vars (see `docs/ENV_VARS.md`):
   - Webhook: `META_WEBHOOK_ENABLED`, `META_VERIFY_TOKEN`, `META_APP_SECRET`, `PAGE_ACCESS_TOKEN`
   - OAuth (optional): `META_APP_ID`, `META_OAUTH_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`
   - CAPI (optional): `META_CAPI_ENABLED=true` + select a pixel after connect
3. In Meta Developer Console, subscribe the Page to `leadgen` webhooks pointing at:
   `https://<api-host>/api/integrations/meta/webhook`
4. Open **Settings → Integrations → Meta** → **Connect Meta** (OAuth) or keep using env page token

## Lead flow

1. Meta POSTs leadgen change → signature verified
2. API responds `EVENT_RECEIVED` immediately
3. Job queued (BullMQ) or processed in-process:
   - Dedupe via `facebook_webhooks.dedupe_key`
   - Fetch lead from Graph with page token
   - Ingest CRM lead via `adLeadService` (idempotent `ad_leads`)
   - Mirror row in `facebook_leads`
   - Auto-assign via assignment rules
   - Enqueue CAPI `Lead` event when enabled

## REST API (authenticated)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/meta/dashboard` | KPI widgets |
| GET | `/api/meta/businesses` | Connected BMs |
| GET | `/api/meta/pages` | Pages |
| GET | `/api/meta/forms` | Lead forms |
| GET | `/api/meta/campaigns` | Campaigns |
| GET | `/api/meta/leads` | Meta lead mirror |
| POST | `/api/meta/connect` | OAuth URL |
| GET | `/api/meta/oauth/callback` | OAuth redirect (public) |
| POST | `/api/meta/sync` | Campaigns / insights |
| POST | `/api/meta/conversion` | Manual CAPI flush |
| PUT | `/api/meta/token` | Refresh long-lived token |
| DELETE | `/api/meta/disconnect` | Revoke connection |

## CAPI status mapping

| CRM status | CAPI event |
|------------|------------|
| `new` | Lead |
| `contacted` | Contact |
| `qualified` | QualifiedLead |
| site visit scheduled | Schedule |
| `won` | Purchase |

PII fields are SHA-256 hashed per Meta requirements. Events are deduped by `event_id` in `facebook_conversion_events`.

## Notes vs requested stack

This monorepo uses **Hono + Drizzle + BullMQ** (not Express/Prisma). Multi-company/branch map to existing `organizations` + `projects` until true multi-tenant branches ship.
