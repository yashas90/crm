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

## Multi-page Lead Ads (DB-backed)

After OAuth **Connect Meta**:

1. Businesses, Pages, Lead Forms, Ad Accounts, and Pixels are synced into `facebook_*` tables.
2. Each Page’s **Page Access Token** is stored encrypted (`facebook_pages.access_token_encrypted`).
3. Every active selected Page is subscribed to **`leadgen`** via Graph `/{page-id}/subscribed_apps`.
4. One webhook URL receives leads for all pages: `/api/integrations/meta/webhook`.
5. On each delivery the API loads the Page token by `page_id`, fetches the lead, and saves it.
6. Enable/disable pages and forms in **Settings → Integrations → Meta**.
7. Pages/forms re-sync on demand (`Sync pages & forms`) and every 6 hours when Redis/BullMQ (or in-process fallback) is running.

**Do not** put Page IDs, Form IDs, or Page Access Tokens in env for this model. App-level secrets only:

- `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_OAUTH_REDIRECT_URI`
- Optional: `META_CAPI_ENABLED`, `REDIS_URL`, `TOKEN_ENCRYPTION_KEY`

Legacy `PAGE_ACCESS_TOKEN` / `META_PAGE_ID` / `META_FORM_IDS` are not used for multi-page ingest.

## Quick start

1. `pnpm db:migrate`
2. Set app-level env: `META_WEBHOOK_ENABLED`, `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_APP_ID`, `META_OAUTH_REDIRECT_URI`
3. In Meta Developer Console, configure the **app** webhook callback to  
   `https://<api-host>/api/integrations/meta/webhook` (Page object + `leadgen`)
4. Open **Settings → Integrations → Meta** → **Connect Meta**
5. Click **Sync pages & forms** (also runs on a 6h schedule)

## Lead flow

1. Meta POSTs leadgen change → signature verified
2. API responds `EVENT_RECEIVED` immediately
3. Job queued (BullMQ) or processed in-process:
   - DB scope: page/form must be active + selected
   - Dedupe via `facebook_webhooks.dedupe_key`
   - Load **Page Access Token from DB** by webhook `page_id`
   - Fetch lead from Graph → CRM ingest → `facebook_leads` mirror
   - Auto-assign + optional CAPI `Lead`

## Env checklist (Phase 1)

```bash
META_WEBHOOK_ENABLED=true
META_VERIFY_TOKEN=propninja-meta-secret
META_APP_ID=xxxxxxxxxxxx
META_APP_SECRET=xxxxxxxxxxxx
META_OAUTH_REDIRECT_URI=https://crm.propninja.in/api/meta/oauth/callback
PUBLIC_API_BASE_URL=https://crm.propninja.in
WEB_APP_URL=https://crm.propninja.in
TOKEN_ENCRYPTION_KEY=<32+ char secret>
```

No `PAGE_ACCESS_TOKEN` / `META_PAGE_ID` / `META_FORM_IDS` — multi-page tokens come from OAuth.

### Webhook verification (before Meta console setup)

`GET /api/integrations/meta/webhook?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`

- Token matches `META_VERIFY_TOKEN` → HTTP 200 with raw `hub.challenge`
- Otherwise → HTTP 403

Then in Meta: Callback URL `https://<api-host>/api/integrations/meta/webhook`, same verify token, subscribe to `leadgen`.

## REST API (authenticated)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/meta/dashboard` | KPI widgets |
| GET/POST | `/api/meta/oauth` | Start OAuth (`{ url }`) |
| POST | `/api/meta/connect` | Alias of `/oauth` |
| GET | `/api/meta/oauth/callback` | OAuth redirect (public) |
| GET | `/api/meta/businesses` | Connected BMs |
| GET | `/api/meta/pages` | Pages (no raw tokens) |
| GET | `/api/meta/forms` | Lead forms |
| GET | `/api/meta/adaccounts` | Ad accounts |
| GET | `/api/meta/pixels` | Pixels |
| GET | `/api/meta/campaigns` | Campaigns |
| GET | `/api/meta/leads` | Meta lead mirror |
| GET | `/api/meta/sync-history` | Sync monitor |
| POST | `/api/meta/sync` | campaigns / insights / assets / all |
| POST | `/api/meta/sync/assets` | Pages + forms + leadgen subscribe |
| PATCH | `/api/meta/pages/:id` | Enable/disable page |
| POST | `/api/meta/pages/:id/reconnect` | Refresh page token + forms |
| PATCH | `/api/meta/forms/:id` | Enable/disable form |
| POST | `/api/meta/conversion` | Manual CAPI enqueue |
| PUT | `/api/meta/token` | Refresh long-lived user token |
| DELETE/POST | `/api/meta/disconnect` | Revoke connection |

OAuth scopes: `business_management`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_manage_ads`, `leads_retrieval`, `ads_management`, `ads_read`, `read_insights`.

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
