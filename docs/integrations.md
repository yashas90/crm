# PropNinja CRM — Ad platform integrations

Production guide for **Meta Lead Ads** (Facebook / Instagram webhooks) and **Google Ads** (scheduled lead form polling).

Status in the app: **Settings → Integrations** (`GET /api/integrations/status`).

---

## Quick checklist (Railway)

1. Run migrations: `pnpm db:migrate`
2. Set env vars on the **API** service (see tables below)
3. Redeploy / restart API
4. Meta: subscribe webhook in Meta Developer Console
5. Google: set `GOOGLE_ADS_SYNC_ENABLED=true`
6. Confirm status shows **Live** for each integration

---

## Meta Lead Ads

### Webhook URL

```
https://<your-api-domain>/api/integrations/meta/webhook
```

Example (production): `https://crm-production-6cfe.up.railway.app/api/integrations/meta/webhook`

### How it works

1. Meta sends `GET` with `hub.mode=subscribe` → API echoes `hub.challenge` when `hub.verify_token` matches `META_VERIFY_TOKEN`.
2. Meta sends `POST` leadgen events → API verifies `X-Hub-Signature-256` with `META_APP_SECRET`, fetches lead fields from Graph API, ingests into `leads`.
3. Mapped fields: `full_name`, `phone_number`, `email`, `ad_name` (+ campaign/ad set/form metadata when available).
4. New leads get `lead_source = "Meta Ads"`, tags `ad_lead` + `facebook_ads`.
5. Duplicate phone or email merges into the existing active lead (same logic as other ad ingest).

### Railway / API env vars

| Variable | Required | Description |
|----------|----------|-------------|
| `META_VERIFY_TOKEN` | **Yes** | String you choose; paste the same value in Meta webhook setup during subscription. |
| `META_APP_SECRET` | **Yes (production)** | Meta app → Settings → Basic → App secret. Used to verify `X-Hub-Signature-256` on every POST. |
| `PAGE_ACCESS_TOKEN` | **Yes** | Long-lived Page token with `leads_retrieval`. Fetches lead field data from Graph API. |
| `META_WEBHOOK_ENABLED` | Recommended | Set `true` in production so startup fails fast if verify token or app secret is missing. |
| `META_PAGE_ID` | No | When set, only leads from this Page ID are ingested. |
| `META_FORM_IDS` | No | Comma-separated form IDs allowlist (optional scoping). |

### Meta Developer Console setup

1. Create a Meta app and add **Webhooks**.
2. Subscribe your Facebook Page to **`leadgen`**.
3. Callback URL: webhook URL above.
4. Verify token: your `META_VERIFY_TOKEN` value.
5. After setting `META_APP_SECRET` and `PAGE_ACCESS_TOKEN` on Railway, re-test the subscription.

---

## Google Ads

### How it works

Google Ads does **not** use a webhook. The API runs an in-process poll loop (`setInterval`, default every 10 minutes) when `GOOGLE_ADS_SYNC_ENABLED=true`:

1. On API boot → immediate sync, then on interval.
2. Uses OAuth refresh token + developer token to query `lead_form_submission_data` via Google Ads API.
3. Maps `FULL_NAME`, `PHONE_NUMBER`, `EMAIL`, etc. to PropNinja leads with `lead_source = "Google Ads"`.
4. Watermark stored in `integration_sync_state` so polls resume after outages.

There is no `node-cron` dependency — scheduling is handled inside the API process.

### Railway / API env vars

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | **Yes** | Google Ads → Tools → API Center |
| `GOOGLE_ADS_CLIENT_ID` | **Yes** | Google Cloud OAuth client |
| `GOOGLE_ADS_CLIENT_SECRET` | **Yes** | Google Cloud OAuth client secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | **Yes** | OAuth refresh token with Google Ads scope |
| `GOOGLE_ADS_CUSTOMER_ID` | **Yes** | Ads account ID (e.g. `123-456-7890`) |
| `GOOGLE_ADS_SYNC_ENABLED` | **Yes** | Set `true` to enable polling |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | No | Manager (MCC) account ID when polling a client account |
| `GOOGLE_ADS_SYNC_INTERVAL_MS` | No | Poll interval (default `600000` = 10 min) |
| `GOOGLE_ADS_LOOKBACK_MINUTES` | No | First-sync lookback (default `70`) |
| `GOOGLE_ADS_SYNC_OVERLAP_MINUTES` | No | Overlap when resuming watermark (default `5`) |

### Manual poll (testing)

Admin-only endpoint to trigger a sync immediately:

```http
POST /api/integrations/google/poll
Authorization: Bearer <admin-jwt>
```

Response: `{ ingested, failed, skipped, errored? }`

---

## Integration status API

`GET /api/integrations/status` (admin/manager with org profile access):

| Field | Meaning |
|-------|---------|
| `facebook.status` | `live` = token + verify token + app secret configured; else `not_configured` |
| `googleAds.status` | `live` = all credentials set **and** `GOOGLE_ADS_SYNC_ENABLED=true`; else `not_configured` |
| `googleAds.lastSyncAt` | Last successful poll timestamp |
| `googleAds.lastSyncError` | Last sync error message (if any) |

---

## Local development

Copy `apps/api/.env.example` to `apps/api/.env` and fill integration vars.

- Meta POST webhooks skip signature verification only when `META_APP_SECRET` is unset **and** `NODE_ENV !== production`.
- Google sync is off until `GOOGLE_ADS_SYNC_ENABLED=true`.

---

## Related files

| Area | Path |
|------|------|
| Meta routes | `apps/api/src/routes/integrationsMeta.ts` |
| Google poll job | `apps/api/src/jobs/googleAdsLeadJob.ts` |
| Lead ingest / merge | `apps/api/src/services/adLeadService.ts` |
| Status | `apps/api/src/lib/integrationsStatus.ts` |
| Env schema | `apps/api/src/lib/env.ts` |

See also [INTEGRATIONS.md](../INTEGRATIONS.md) in the repo root for narrative setup notes.
