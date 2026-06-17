# PropNinja CRM v1.0 — Launch Checklist

Complete every item before announcing **v1.0** to the team.

Related: [pre-launch-security.md](./pre-launch-security.md) · [DEPLOY.md](../DEPLOY.md) · [integrations.md](./integrations.md)

---

## 1. Credentials & access

- [ ] **Admin creates all agent accounts** before go-live (Users → Add user — no invite flow)
- [ ] **Each agent logs in and changes their password** on first login (welcome modal)
- [ ] **Reset admin password** after seeding production DB:
  ```bash
  # Local with production DATABASE_URL, or on Railway:
  railway run bash -c 'NEW_ADMIN_EMAIL=you@yourcompany.com NEW_ADMIN_PASSWORD=<strong-password> pnpm reset:admin'
  ```
- [ ] Confirm `ALLOW_DEMO_AUTH=false` on Railway
- [ ] Remove or rotate any demo seed passwords if `pnpm db:seed` was run on production

---

## 2. Railway — API + Postgres

Set all variables on the **crm** API service (Postgres `DATABASE_URL` is usually linked from the plugin).

### Required

| Variable | Example / notes |
|----------|-----------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | From Railway Postgres plugin (internal URL) |
| `AUTH_JWT_SECRET` | Long random string (min 16 chars) |
| `ALLOW_DEMO_AUTH` | `false` |
| `CORS_ORIGINS` | `https://www.ninjamarketing.in,https://ninjamarketing.in` |

### Recommended

| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` | API error tracking |
| `RAILWAY_GIT_COMMIT_SHA` | Auto on Railway — Sentry release |
| `REDIS_URL` | Distributed rate limiting (optional) |

### Meta Lead Ads (when live)

| Variable | Purpose |
|----------|---------|
| `META_WEBHOOK_ENABLED` | `true` in production |
| `META_VERIFY_TOKEN` | Handshake token (must match Meta Developer Console) |
| `META_APP_SECRET` | `X-Hub-Signature-256` verification (**required in production**) |
| `PAGE_ACCESS_TOKEN` | Graph API `leads_retrieval` |
| `META_PAGE_ID` | Optional — restrict to one Page |
| `META_FORM_IDS` | Optional — comma-separated form allowlist |

Webhook URL: `https://crm-production-6cfe.up.railway.app/api/integrations/meta/webhook`

### Google Ads (when live)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Ads API developer token |
| `GOOGLE_ADS_CLIENT_ID` | OAuth client ID |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | OAuth refresh token |
| `GOOGLE_ADS_CUSTOMER_ID` | Customer ID |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Optional MCC manager ID |
| `GOOGLE_ADS_SYNC_ENABLED` | `true` to enable polling |
| `GOOGLE_ADS_SYNC_INTERVAL_MS` | Default `600000` (10 min) |
| `GOOGLE_ADS_LOOKBACK_MINUTES` | Default `70` |
| `GOOGLE_ADS_SYNC_OVERLAP_MINUTES` | Default `5` |

### Deploy verification

- [ ] `GET https://crm-production-6cfe.up.railway.app/health` → `200`, `{ "status": "ok", "version", "timestamp", "db": "ok" }`
- [ ] Deploy logs show migrations applied

---

## 3. Vercel — Web dashboard

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://crm-production-6cfe.up.railway.app` |
| `SENTRY_DSN_WEB` | Sentry DSN (optional) |
| `SENTRY_AUTH_TOKEN` | Source map upload (optional) |
| `SENTRY_ORG` | Sentry org slug (if uploading maps) |
| `SENTRY_PROJECT` | e.g. `propninja-web` (if uploading maps) |

Vercel sets automatically (used by `/status` page):

- `VERCEL_GIT_COMMIT_SHA`

### Domains

- [ ] `www.ninjamarketing.in` and `ninjamarketing.in` attached
- [ ] Production deploy succeeded
- [ ] `https://www.ninjamarketing.in/status` shows API + DB green

---

## 4. Mobile — EAS production build

- [ ] `EXPO_PUBLIC_API_URL` in `apps/mobile/eas.json` production profile points at Railway API
- [ ] Run production build:
  ```bash
  cd apps/mobile
  eas build --platform android --profile production
  eas build --platform ios --profile production
  ```
- [ ] Distribute APK/IPA to agents (internal track or TestFlight)
- [ ] Agent login + leads list + call log smoke test on a physical device

See [apps/mobile/EAS_SETUP.md](../apps/mobile/EAS_SETUP.md).

---

## 5. Integrations

### Meta Business Manager

- [ ] App created in [Meta Developer Console](https://developers.facebook.com/)
- [ ] Webhook subscribed: `leadgen` on Page
- [ ] Callback URL: `https://crm-production-6cfe.up.railway.app/api/integrations/meta/webhook`
- [ ] Verify token matches `META_VERIFY_TOKEN`
- [ ] Test lead submission appears in CRM with `lead_source = Meta Ads`

### Google Ads

- [ ] OAuth credentials and developer token in Railway env
- [ ] `GOOGLE_ADS_SYNC_ENABLED=true`
- [ ] `POST /api/integrations/google/poll` (admin) or wait for scheduled job
- [ ] Test lead appears in CRM

Details: [integrations.md](./integrations.md)

---

## 6. Sentry

- [ ] `SENTRY_DSN` on Railway (API)
- [ ] `SENTRY_DSN_WEB` on Vercel (web)
- [ ] Verify errors arrive:
  ```bash
  curl -H "Authorization: Bearer <admin-jwt>" https://www.ninjamarketing.in/api/sentry-test
  ```
- [ ] Confirm JWT/password/phone are scrubbed in Sentry payloads

---

## 7. End-to-end smoke test

Run this flow on production (or staging with production-like config):

1. [ ] **Web login** — admin at `https://www.ninjamarketing.in/login`
2. [ ] **Create lead** — name, phone, source; save
3. [ ] **Assign to agent** — pick an active agent user
4. [ ] **Mobile** — agent logs in, opens lead, taps Call, returns and **logs call**
5. [ ] **Reports** — admin opens Calls report; new call appears with correct agent and lead
6. [ ] **Status page** — `/status` shows API operational and DB connected

---

## 8. Release

- [ ] `pnpm check:ci` passes on `main`
- [ ] `CHANGELOG.md` updated for v1.0.0
- [ ] Git tag: `v1.0.0`
- [ ] Tag pushed: `git push origin v1.0.0`

---

## Quick links

| Resource | URL |
|----------|-----|
| Web | https://www.ninjamarketing.in |
| Status | https://www.ninjamarketing.in/status |
| API | https://crm-production-6cfe.up.railway.app |
| Health | https://crm-production-6cfe.up.railway.app/health |
