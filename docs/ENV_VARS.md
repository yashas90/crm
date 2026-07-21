# PropNinja CRM — Environment Variables

Cross-reference for Railway (API), Vercel (web), and EAS (mobile).  
Last updated: 2026-06-16 (QA audit).

---

## Production API URLs

| Role | URL | Notes |
|------|-----|-------|
| **Live (APAC)** | `https://crm-production-e81d.up.railway.app` | Railway project `propninja-crm-mumbai` — API + Postgres in **Singapore** |
| **US (rollback — decommission)** | `https://crm-production-6cfe.up.railway.app` | Old project `propninja-crm` — delete when no longer needed |

Web: Vercel `bom1` · Mobile: `EXPO_PUBLIC_API_URL` in `eas.json` · Both point at **e81d** above.

See [REGION_MIGRATION.md](./REGION_MIGRATION.md).

---

## Railway — API service

| Variable | Required | Purpose |
|----------|----------|---------|
| `NODE_ENV` | **Yes** | Must be `production` in prod |
| `DATABASE_URL` | **Yes** | PostgreSQL connection (Railway plugin) |
| `AUTH_JWT_SECRET` | **Yes** | JWT signing (min 64 chars in production) |
| `JWT_SECRET` | Alias | Same as `AUTH_JWT_SECRET` |
| `ALLOW_DEMO_AUTH` | **Yes** | Must be `false` in production |
| `CORS_ORIGINS` | **Yes** | Comma-separated web origins (no wildcards) |
| `PORT` | No | Default `3001` |
| `SENTRY_DSN` | Recommended | API error tracking |
| `RAILWAY_GIT_COMMIT_SHA` | Auto | Sentry release correlation |
| `REDIS_URL` | Optional | Distributed rate limiting |
| `RESEND_API_KEY` | Recommended | Password reset emails |
| `RESEND_FROM_EMAIL` | With Resend | From address |
| `WEB_APP_URL` | Recommended | Password reset + OAuth return base (e.g. `https://crm.propninja.in`) |
| `PUBLIC_API_BASE_URL` | Recommended | Public API origin for OAuth redirect fallback |
| `REPORT_EMAIL_UNSUBSCRIBE_SECRET` | Optional | Defaults to JWT secret |
| `HEALTH_ADMIN_TOKEN` | Optional | Protects `/api/health/detailed` |
| `META_WEBHOOK_ENABLED` | When live | `true` requires Meta vars |
| `META_VERIFY_TOKEN` | When Meta live | Webhook handshake (exact match in Meta console) |
| `META_APP_SECRET` | When Meta live | HMAC verification + OAuth |
| `META_APP_ID` | OAuth connect | Meta Developer App ID |
| `META_OAUTH_REDIRECT_URI` | OAuth connect | Must match Meta Login redirect (e.g. `https://crm.propninja.in/api/meta/oauth/callback`) |
| `TOKEN_ENCRYPTION_KEY` | Recommended | Encrypts stored Meta user/page tokens |
| `META_GRAPH_API_VERSION` | Optional | Default `v21.0` |
| `META_CAPI_ENABLED` | Optional | `true` to send Conversions API events on lead status changes |
| `GOOGLE_ADS_*` | When Google live | See `apps/api/src/lib/env.ts` |

> **Meta Lead Ads:** do **not** set page IDs or page access tokens in env. After OAuth, page tokens live encrypted in `facebook_pages`. See [META_BUSINESS_INTEGRATION.md](./META_BUSINESS_INTEGRATION.md).
| `CLOUDFLARE_R2_*` | When docs live | R2 storage credentials |
| `API_PUBLIC_URL` | Recommended | Document share/view links |
| `WHATSAPP_API_TOKEN` | When WhatsApp live | Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | When WhatsApp live | Sender number ID |
| `WHATSAPP_VERIFY_TOKEN` | Optional | Defaults to `META_VERIFY_TOKEN` |

### Dev-only (do not set in production)

| Variable | Purpose |
|----------|---------|
| `DEMO_ORG_ID`, `DEMO_USER_*`, `DEMO_ORG_*` | Demo auth fallback |
| `ALLOW_DEMO_AUTH=true` | Dev login bypass |

---

## Vercel — Web app

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | **Yes** | Railway API base URL |
| `NEXT_PUBLIC_SENTRY_DSN_WEB` | Recommended | Client Sentry DSN |
| `SENTRY_DSN_WEB` | Optional | Server/edge Sentry (falls back to public) |
| `SENTRY_AUTH_TOKEN` | Optional | Source map upload |
| `SENTRY_ORG` | With token | Sentry org slug |
| `SENTRY_PROJECT` | With token | Sentry project slug |
| `VERCEL_GIT_COMMIT_SHA` | Auto | Build metadata / Sentry release |
| `NODE_ENV` | Auto | Set by Vercel |

---

## EAS / Mobile build

| Variable | Required | Purpose |
|----------|----------|---------|
| `EXPO_PUBLIC_API_URL` | **Yes** (release) | Production API URL |
| `EXPO_PUBLIC_SENTRY_DSN_MOBILE` | Recommended | Mobile Sentry |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | Recommended | Privacy policy link |
| `EXPO_PUBLIC_API_CERT_SHA256` | Optional | SSL pinning hashes |
| `EXPO_PUBLIC_DISABLE_SSL_PINNING` | Dev only | Set `1` to disable pinning |
| `EXPO_PUBLIC_API_PORT` | Dev only | Local API port (default 3001) |
| `EAS_PROJECT_ID` | Build | Expo project ID |
| `EXPO_OWNER` | Build | Expo account owner |

---

## CI (GitHub Actions)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Test Postgres |
| `AUTH_JWT_SECRET` | Test JWT (32+ chars) |
| `NEXT_PUBLIC_API_URL` | Web build/test |
| `CI` | Disables husky |

---

## Variables referenced in code but not in deploy docs (add to Railway if used)

| Variable | App | Notes |
|----------|-----|-------|
| `GIT_COMMIT` | API | Fallback for Sentry release |
| `VITEST` | Test only | Skips server bind in tests |

---

## Orphan deploy vars (in docs but verify usage)

All variables listed in `DEPLOY.md` are referenced in `apps/api/src/lib/env.ts` or integration code.

---

## Validation

- API env schema: `apps/api/src/lib/env.ts` (Zod)
- Web requires `NEXT_PUBLIC_API_URL` in production (`apps/web/src/lib/apiClient.ts`)
- Mobile requires `EXPO_PUBLIC_API_URL` in release builds (`apps/mobile/src/lib/apiBaseUrl.ts`)

Generate JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Reset admin password:

```bash
NEW_ADMIN_EMAIL=you@company.com NEW_ADMIN_PASSWORD='…' pnpm reset:admin
```
