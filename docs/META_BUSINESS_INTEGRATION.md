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

## Real-time Lead Ads (24×7)

**Primary:** Meta `leadgen` webhooks → `POST /api/integrations/meta/webhook` → signature verify → BullMQ `meta-webhook` job → Page token from DB → Graph lead fetch → CRM ingest (dedupe) → assign → notify → follow-up task. Target: visible in CRM within seconds.

**Backup only:** every **5 minutes**, reconcile last 1 day of form leads from Graph (skips duplicates). Asset auto-sync + campaign sync also every 5 minutes (does not overwrite Enable/Disable / assignees). Token refresh check hourly.

**Live UI:** Settings → Meta → **Live Meta Leads** (5s refresh) + webhook health **Healthy / Delayed / Offline**.


After OAuth **Connect Meta**:

1. Businesses, Pages, Lead Forms, Ad Accounts, and Pixels are synced into `facebook_*` tables.
2. Each Page’s **Page Access Token** is stored encrypted (`facebook_pages.access_token_encrypted`).
3. Every active selected Page is subscribed to **`leadgen`** via Graph `/{page-id}/subscribed_apps`.
4. One webhook URL receives leads for all pages: `/api/integrations/meta/webhook`.
5. On each delivery the API loads the Page token by `page_id`, fetches the lead, and saves it.
6. Enable/disable pages and forms in **Settings → Integrations → Meta**.
7. Pages/forms re-sync on demand (**Sync assets**) and every 6 hours when Redis/BullMQ (or in-process fallback) is running. Discovery includes personal pages plus Business Manager **owned** and **client** pages.
8. If **Leads (30d)** stays at 0 while Meta Ads Manager shows leads, live webhooks are not reaching the API — use **Pull leads (7d)** to backfill from Graph, then fix the app webhook callback (below). The API also auto-pulls the last 2 days of leads every 15 minutes as a webhook fallback.
9. On **Forms → Assign**, open **Lead Assignment**: choose sequential (round-robin) or always-first, then **Select users** or **All users**. New Meta leads from that form go directly to those agents; **Clear assignees** falls back to **Settings → Assignment rules**.
10. To **add a new Page**: **Reconnect Meta** → select that Page in the Facebook dialog → **Sync assets**. Pages missing a token show **No token** until reconnect.

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
| POST | `/api/meta/sync` | campaigns / insights / assets / all / leads |
| POST | `/api/meta/sync/assets` | Pages + forms + leadgen subscribe |
| POST | `/api/meta/sync/leads?sinceDays=7` | Backfill Lead Ads from Graph (missed webhooks) |
| PATCH | `/api/meta/pages/:id` | Enable/disable page |
| POST | `/api/meta/pages/:id/reconnect` | Refresh page token + forms |
| PATCH | `/api/meta/forms/:id` | Enable/disable form |
| POST | `/api/meta/conversion` | Manual CAPI enqueue |
| PUT | `/api/meta/token` | Refresh long-lived user token |
| DELETE/POST | `/api/meta/disconnect` | Revoke connection |

OAuth scopes: `business_management`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_manage_ads`, `leads_retrieval`, `ads_management`, `ads_read`.

## Conversions API (CAPI) — enable checklist

1. Set `META_CAPI_ENABLED=true` on the API (Railway). Optional: `META_CAPI_TEST_EVENT_CODE` from Events Manager → Test Events while validating.
2. **Settings → Integrations → Meta** → **Connect Meta** (scopes must include `ads_read` / `ads_management` so pixels sync).
3. Click **Sync assets** — pixels appear under **Pixels / CAPI**.
4. **Enable** the pixel you use for ads, then **Set default**.
5. Confirm the CAPI banner shows **Enabled · N ready pixel(s)**.
6. Change a lead status (`new` / `contacted` / `qualified` / `won`) or click **Flush pending events**.
7. In Meta **Events Manager** → your Pixel → **Overview** / **Test Events**, confirm server events arrive (often within a few minutes).

| CRM status | CAPI event |
|------------|------------|
| `new` | Lead |
| `contacted` | Contact |
| `qualified` | QualifiedLead |
| site visit scheduled | Schedule |
| `won` | Purchase |

PII fields are SHA-256 hashed per Meta requirements. Events are deduped by `event_id` in `facebook_conversion_events`. PATCH `/api/meta/pixels/:id` controls `isActive` / `isSelected` / `isDefault`.

## Notes vs requested stack

This monorepo uses **Hono + Drizzle + BullMQ** (not Express/Prisma). Multi-company/branch map to existing `organizations` + `projects` until true multi-tenant branches ship.
