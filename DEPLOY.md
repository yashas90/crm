# Deploying PropNinja CRM

Production layout:

| Component | Host | URL (current) |
|-----------|------|----------------|
| API + Postgres | **Railway** (or Render) | `https://crm-production-6cfe.up.railway.app` |
| Web dashboard | **Vercel** | `https://www.ninjamarketing.in` |
| Mobile app | Expo EAS | Points at Railway API URL |

The API runs migrations on every deploy (`pnpm railway:start` → `db:migrate` then `api start`).

---

## Prerequisites

1. Code pushed to GitHub (`https://github.com/yashas90/crm.git`).
2. `pnpm check:ci` passes locally (migrate + seed + lint/test/build).
3. Strong `AUTH_JWT_SECRET` (min 16 chars) — never reuse the dev default in production.

---

## Railway (API + Postgres) — recommended

Already configured via `railway.toml` at repo root.

### First-time setup

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub** → select `crm`.
2. Add **PostgreSQL** plugin to the project.
3. Add a **Service** for the API (same repo). Railway reads `railway.toml`:
   - **Build:** `pnpm install && pnpm railway:build`
   - **Start:** `pnpm db:migrate && pnpm --filter @propninja/api start`
   - **Health check:** `/health`
4. On the **crm** service → **Variables** → reference Postgres `DATABASE_URL` (or paste the internal URL).
5. Set required variables:

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `AUTH_JWT_SECRET` | long random secret |
| `ALLOW_DEMO_AUTH` | `false` |
| `CORS_ORIGINS` | `https://www.ninjamarketing.in,https://ninjamarketing.in` |

6. Optional (recommended as you scale):

| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` | API error tracking |
| `REDIS_URL` | Distributed rate limiting (in-memory fallback if unset) |
| `META_VERIFY_TOKEN`, `META_APP_SECRET`, `PAGE_ACCESS_TOKEN` | Facebook Lead Ads webhook |
| `GOOGLE_ADS_*` | Google Ads lead sync — see [INTEGRATIONS.md](INTEGRATIONS.md) |

7. Deploy. Confirm: `GET https://<your-domain>/health` → `200`.

### Redeploy

- **Git push to `main`** if the Railway service is connected to GitHub (auto-deploy).
- Or from repo root: `railway service crm && railway up`

### Seed production (once)

Railway shell or local with production `DATABASE_URL`:

```bash
pnpm db:seed
```

Then log in with seeded admin (`admin@propninja.local` / `admin`) or create users via the web UI.

---

## Render (API + Postgres) — alternative to Railway

Use `render.yaml` in the repo root (Blueprint).

1. [render.com](https://render.com) → **New** → **Blueprint** → connect GitHub repo.
2. Render provisions **Postgres** + **Web Service** (`propninja-api`).
3. Set the same env vars as Railway (Render dashboard → **Environment**).
4. `AUTH_JWT_SECRET` must be set manually (marked `sync: false` in the blueprint).
5. After first deploy, set `CORS_ORIGINS` to your Vercel domain(s).

Health check: `/health`.

---

## Vercel (Web)

Configured via `apps/web/vercel.json` (monorepo install/build from root).

### First-time setup

1. [vercel.com](https://vercel.com) → **Add New Project** → import `crm` from GitHub.
2. **Root Directory:** `apps/web`
3. Framework preset: **Next.js** (overridden by `vercel.json`):
   - Install: `cd ../.. && NODE_ENV=development pnpm install`
   - Build: `cd ../.. && pnpm --filter @propninja/web build`
4. **Environment variables** (Production):

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://crm-production-6cfe.up.railway.app` |
| `SENTRY_DSN_WEB` | optional Sentry browser DSN |

5. Add custom domain (e.g. `www.ninjamarketing.in`) under **Domains**.
6. Deploy. Open the site and sign in.

### Redeploy

Push to `main` (auto) or Vercel dashboard → **Redeploy**.

---

## Post-deploy checklist

- [ ] `GET <API>/health` → 200
- [ ] Web loads and login works (`NEXT_PUBLIC_API_URL` matches API URL)
- [ ] Browser network tab: API calls go to Railway/Render, not `localhost`
- [ ] `CORS_ORIGINS` includes all Vercel/custom domains
- [ ] `ALLOW_DEMO_AUTH=false` in production
- [ ] Migrations applied (check Railway/Render deploy logs for `migrations applied`)
- [ ] Meta webhook URL: `https://<API>/api/integrations/meta/webhook`
- [ ] Optional: Sentry receiving test errors; Redis connected if using `REDIS_URL`

---

## Mobile (Expo)

Full EAS walkthrough: [apps/mobile/EAS_SETUP.md](apps/mobile/EAS_SETUP.md)

Production API URL is in `apps/mobile/eas.json`. After changing the API host, update `eas.json` and rebuild:

```bash
cd apps/mobile
pnpm eas:login
pnpm eas:init
pnpm eas:build:preview:android   # APK for QA
pnpm eas:build:android           # AAB for Play Store
pnpm eas:build:ios               # IPA for App Store
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Web CORS errors | Add exact origin(s) to API `CORS_ORIGINS` (no trailing slash) |
| `AUTH_JWT_SECRET` boot error | Set on API service, min 16 characters |
| `column "username" does not exist` | Migrations not applied — redeploy API or run `pnpm db:migrate` |
| 502 on Railway/Render | Check deploy logs; confirm `PORT` is provided by platform (Railway sets it automatically) |
| Vercel build fails on workspace | Ensure install/build commands in `vercel.json` run from monorepo root |
