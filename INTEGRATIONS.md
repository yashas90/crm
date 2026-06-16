# Ad lead integrations

> **Production setup:** see [docs/integrations.md](docs/integrations.md) for Railway env vars, webhook URL, and Google Ads polling.

PropNinja ingests leads from **Meta Lead Ads** (Facebook / Instagram) via webhook and from **Google Ads** lead forms via a background sync job. Configure env vars on the API server (`apps/api/.env`). Status is visible at **Settings → Integrations** in the web app.

Ingested leads are tagged `ad_lead`, tagged by platform (`facebook_ads` / `google_ads`), and appear in reports under **Meta Ads** and **Google Ads**.

---

## Before you go live

1. **Run the latest DB migration** (required for Google sync watermark):

   ```bash
   pnpm db:migrate
   ```

2. Set all env vars in `apps/api/.env` (see below).
3. **Restart the API** after changing env vars.
4. Confirm status at **Settings → Integrations** (web app).

---

## What you need to provide

### Facebook / Instagram

| What you provide | Env var | Where to get it |
|------------------|---------|-----------------|
| A verify token you invent | `META_VERIFY_TOKEN` | You choose this string; paste the same value in Meta webhook setup |
| App secret | `META_APP_SECRET` | Meta Developer Console → your app → **Settings → Basic → App secret** |
| Page access token | `PAGE_ACCESS_TOKEN` | Meta Graph API Explorer or token tool — long-lived token for your Page with `leads_retrieval` |
| Public webhook URL | — | `https://<api-domain>/api/integrations/meta/webhook` |
| Page ID (optional) | `META_PAGE_ID` | Facebook Page → About |
| Form IDs (optional) | `META_FORM_IDS` | Comma-separated, for your own reference |

**Production:** `META_APP_SECRET` is required. Without it, webhooks are accepted but not cryptographically verified.

### Google Ads

| What you provide | Env var | Where to get it |
|------------------|---------|-----------------|
| Developer token | `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads → Tools → API Center |
| OAuth client ID | `GOOGLE_ADS_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials |
| OAuth client secret | `GOOGLE_ADS_CLIENT_SECRET` | Same credentials screen |
| OAuth refresh token | `GOOGLE_ADS_REFRESH_TOKEN` | One-time OAuth flow with Google Ads scope |
| Customer ID | `GOOGLE_ADS_CUSTOMER_ID` | Google Ads account (e.g. `123-456-7890`) |
| Enable sync | `GOOGLE_ADS_SYNC_ENABLED` | Set to `true` |
| MCC / manager ID (if applicable) | `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Manager account when polling a client account |

Sync progress is stored in the `integration_sync_state` table so polls resume after outages instead of relying only on a short lookback window.

---

## Facebook / Instagram (Meta Lead Ads)

### Setup

1. Create a [Meta app](https://developers.facebook.com/) and connect your Facebook **Page** (Lead Ads run on the Page).
2. Add the **Webhooks** product and subscribe your Page to **`leadgen`** events.
3. Set the callback URL to:

   ```
   https://<api-domain>/api/integrations/meta/webhook
   ```

4. When Meta prompts for a verify token, use your `META_VERIFY_TOKEN` value.
5. Set `META_APP_SECRET` and `PAGE_ACCESS_TOKEN` on the API server, then restart the API.
6. Re-verify the webhook subscription if you change the verify token.

### Env vars

| Variable | Required | Description |
|----------|----------|-------------|
| `META_VERIFY_TOKEN` | Yes | Shared secret for webhook subscription handshake. |
| `META_APP_SECRET` | **Yes (production)** | Verifies `X-Hub-Signature-256` on every POST webhook. |
| `PAGE_ACCESS_TOKEN` | Yes | Fetches lead field data from Graph API. |
| `META_PAGE_ID` | No | When set, only leads from this Page ID are ingested. |
| `META_FORM_IDS` | No | When set, only listed form IDs are ingested (comma-separated). |

Webhook routes are public (no JWT). Invalid signatures return **403 Forbidden**.

---

## Google Ads (lead form submissions)

### Setup

1. Create a [Google Cloud project](https://console.cloud.google.com/) and enable the **Google Ads API**.
2. Create **OAuth 2.0** credentials. Note client ID and secret.
3. Obtain a **developer token** from your Google Ads manager account.
4. Run the OAuth flow once to get a **refresh token** scoped for Google Ads.
5. Note the **customer ID** that receives lead form submissions.
6. Set env vars, set `GOOGLE_ADS_SYNC_ENABLED=true`, run `pnpm db:migrate`, restart API.

### Env vars

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Yes | Google Ads API developer token. |
| `GOOGLE_ADS_CLIENT_ID` | Yes | OAuth 2.0 client ID. |
| `GOOGLE_ADS_CLIENT_SECRET` | Yes | OAuth 2.0 client secret. |
| `GOOGLE_ADS_REFRESH_TOKEN` | Yes | OAuth refresh token. |
| `GOOGLE_ADS_CUSTOMER_ID` | Yes | Ads customer ID (with or without dashes). |
| `GOOGLE_ADS_SYNC_ENABLED` | Yes | `true` to start polling on API boot. |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | If using MCC | Manager account ID. |
| `GOOGLE_ADS_SYNC_INTERVAL_MS` | No | Default `600000` (10 min). |
| `GOOGLE_ADS_LOOKBACK_MINUTES` | No | Default `70` — used only on **first** sync (no watermark yet). |
| `GOOGLE_ADS_SYNC_OVERLAP_MINUTES` | No | Default `5` — overlap when resuming from watermark. |

**How sync works:** Each successful poll stores `last_success_at` in `integration_sync_state`. The next poll fetches submissions since that timestamp minus the overlap buffer. Failed polls record `last_error` and do not advance the watermark.

---

## Local development

Meta webhooks need a public HTTPS URL. Use a tunnel (e.g. ngrok) pointing at `http://localhost:3001`:

```
https://<tunnel-host>/api/integrations/meta/webhook
```

For Google Ads: set credentials in `apps/api/.env`, `GOOGLE_ADS_SYNC_ENABLED=true`, run `pnpm db:migrate`, restart API.

See `apps/api/.env.example` for a full variable list.
