# PropNinja CRM — Pre-launch security checklist

Use this before pointing production traffic at **ninjamarketing.in** and the Railway API.

---

## Railway API

### TLS / domain

- [ ] API served over HTTPS only (`https://crm-production-6cfe.up.railway.app` or custom domain)
- [ ] Railway health check path: `/health`
- [ ] Health response includes `{ status: "ok", version, timestamp }` (503 when DB unreachable)

### CORS (`CORS_ORIGINS`)

Set on the API service (comma-separated, **no trailing slashes**):

```env
CORS_ORIGINS=https://www.ninjamarketing.in,https://ninjamarketing.in
```

- [ ] Both production web origins are listed
- [ ] **No wildcard (`*`)** — the API rejects `*` in production at startup
- [ ] Localhost origins are **not** included in production (dev-only)
- [ ] Preflight `OPTIONS` is handled by Hono CORS middleware (`Allow-Methods`, `Allow-Headers`, `Max-Age`)

**Verify:** open the web app, sign in, and confirm browser network requests to the API succeed without CORS errors.

### Rate limiting

| Scope | Limit | Applies to |
|-------|-------|------------|
| Public (per IP) | 100 req/min | Login, Meta webhook, unauthenticated traffic |
| Authenticated (per user) | 500 req/min | All `/api/*` routes after JWT validation |
| Login (per IP) | 20 req/min | Additional bucket on `POST /api/auth/login` |
| Meta webhook (per IP) | 120 req/min | `POST /api/integrations/meta/webhook` |

- [ ] `429` responses include `Retry-After` header (seconds)
- [ ] Optional: set `REDIS_URL` for distributed rate limits across multiple API instances

### Auth & secrets

- [ ] `AUTH_JWT_SECRET` — long random value (min 16 chars), not the dev default
- [ ] `ALLOW_DEMO_AUTH=false`
- [ ] `NODE_ENV=production`
- [ ] Meta webhook: `META_APP_SECRET` set (signature verification enforced in production)

### Error tracking

- [ ] `SENTRY_DSN` set (optional but recommended)
- [ ] `RAILWAY_GIT_COMMIT_SHA` present for Sentry release correlation (automatic on Railway)

---

## Vercel Web

### Environment

```env
NEXT_PUBLIC_API_URL=https://crm-production-6cfe.up.railway.app
SENTRY_DSN_WEB=https://…@….ingest.sentry.io/…
```

Optional (source maps):

```env
SENTRY_AUTH_TOKEN=…
SENTRY_ORG=…
SENTRY_PROJECT=…
```

- [ ] `NEXT_PUBLIC_API_URL` points at the production API (not `localhost`)
- [ ] Custom domains: `www.ninjamarketing.in`, `ninjamarketing.in`

### Security headers (`next.config.mjs`)

Configured on all routes:

| Header | Value |
|--------|--------|
| `Content-Security-Policy` | `connect-src` allows self, API origin, Sentry ingest; `form-action` allows `wa.me` / WhatsApp |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

- [ ] CSP `connect-src` includes your Railway API host
- [ ] WhatsApp lead links (`wa.me`) work from lead detail pages

### Session

- [ ] Dashboard routes protected by Next.js middleware (`propninja_session` cookie)
- [ ] JWT stored in `localStorage` — never logged to Sentry (scrubbed in `beforeSend`)

### Sentry test (admin)

```bash
curl -H "Authorization: Bearer <admin-jwt>" https://www.ninjamarketing.in/api/sentry-test
```

- [ ] Test error appears in Sentry project

---

## Mobile (Expo / EAS)

### API URL

All API traffic uses `getApiBaseUrl()` → `EXPO_PUBLIC_API_URL` (or `expo.extra.apiUrl` from `app.config.ts` at build time).

**No hardcoded Railway URLs in `apps/mobile/src`.**

Set in `eas.json` for preview/production builds:

```json
"EXPO_PUBLIC_API_URL": "https://crm-production-6cfe.up.railway.app"
```

- [ ] `EXPO_PUBLIC_API_URL` set in EAS build profiles before each store release
- [ ] Release build fails fast if URL is missing (no silent fallback in app code)
- [ ] Physical device dev: `EXPO_PUBLIC_API_URL=http://<LAN_IP>:3001`

### Transport

- [ ] Production API URL uses `https://`
- [ ] Auth tokens in `expo-secure-store` (not plain AsyncStorage)

---

## Cross-cutting

### Data minimization in Sentry

- [ ] No JWTs, passwords, or phone numbers in Sentry payloads (`beforeSend` scrubbers on API + web)
- [ ] Sentry user context: `userId` + `role` only

### Integrations

See [integrations.md](./integrations.md):

- [ ] Meta Lead Ads webhook URL registered with HTTPS
- [ ] Google Ads sync enabled only when credentials are ready

### Post-deploy smoke tests

- [ ] `GET https://<api>/health` → 200, `status: "ok"`
- [ ] Web login → dashboard loads
- [ ] Mobile login → leads list loads
- [ ] Lead detail → WhatsApp link opens
- [ ] Admin credentials rotated after initial seed (`pnpm reset:admin`)

---

## Quick reference

| Service | URL |
|---------|-----|
| Web | https://www.ninjamarketing.in |
| API | https://crm-production-6cfe.up.railway.app |
| Health | `GET /health` |
| Meta webhook | `POST /api/integrations/meta/webhook` |

Related docs: [DEPLOY.md](../DEPLOY.md), [integrations.md](./integrations.md).
