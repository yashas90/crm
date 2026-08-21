# Deploying PropNinja CRM

Production layout:

| Component | Host | URL (current) |
|-----------|------|----------------|
| API + Postgres | **Railway** (or Render) | `https://crm-production-e81d.up.railway.app` |
| Web dashboard | **Vercel** project **`crm-api`** (Root Directory `apps/web`) | `https://www.ninjamarketing.in` |
| Mobile app | Expo EAS | Points at Railway API URL |

> Note: A second Vercel project named `propninjacrm` may also be connected to the same GitHub repo. It must use **Root Directory = `apps/web`** and **Framework = Next.js**. If Root Directory is `.`, the build finishes then fails with `No Output Directory named "public"`.

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
| `SENTRY_DSN` | API error tracking (scrubs JWT/password/phone from payloads) |
| `RAILWAY_GIT_COMMIT_SHA` | Set by Railway — used as Sentry `release` for deploy correlation |
| `REDIS_URL` | Distributed rate limiting (in-memory fallback if unset) |
| `META_WEBHOOK_ENABLED` | Set `true` in production to require Meta vars at startup |
| `META_VERIFY_TOKEN` | Meta webhook subscription handshake (you choose this string; must match Meta Developer Console) |
| `META_APP_SECRET` | Verifies `X-Hub-Signature-256` on Meta POST webhooks (**required in production**) |
| `PAGE_ACCESS_TOKEN` | Meta Graph API — fetches lead field data (`leads_retrieval`) |
| `META_PAGE_ID` | Optional — scope ingestion to one Facebook Page |
| `META_FORM_IDS` | Optional — comma-separated lead form allowlist |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API developer token |
| `GOOGLE_ADS_CLIENT_ID` | OAuth client ID |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | OAuth refresh token (Google Ads scope) |
| `GOOGLE_ADS_CUSTOMER_ID` | Google Ads customer ID |
| `GOOGLE_ADS_SYNC_ENABLED` | Set `true` to enable lead form polling |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Optional MCC manager ID |

Full integration setup: [docs/integrations.md](docs/integrations.md)

7. Deploy. Confirm: `GET https://<your-domain>/health` → `200`.

### Redeploy

- **Git push to `main`** if the Railway service is connected to GitHub (auto-deploy).
- Or from repo root: `railway service crm && railway up`
- Or Railway dashboard → service → **Deployments** → **Deploy** / **Redeploy**.

**Verify the new build is live** (do not trust a green deploy alone):

```bash
curl -s https://crm-production-e81d.up.railway.app/health
```

You must see something like:

- `"version": "0.0.8"` (or higher — not `0.0.0`)
- `"deployMarker": "nixpacks-guard-2026-08-21"` (or the current marker in code)
- `"gitSha": "..."` when Railway sets `RAILWAY_GIT_COMMIT_SHA`

If `/health` still shows `"version":"0.0.0"` and **no** `deployMarker` / `gitSha`, the public URL is still running an **old** image. Common causes:

1. **Redeployed an old deployment** instead of deploying latest `main` — use **Deploy** from GitHub `main`, not “Redeploy” on an ancient build.
2. **Wrong service** — confirm the service behind `crm-production-e81d.up.railway.app`.
3. **Wrong branch / repo** — Settings → Source should be `yashas90/crm` branch `main`, **Root Directory = empty** (repo root where `Dockerfile` / `railway.toml` live). Do **not** set Root Directory to `apps/api` or `apps/web`.
4. **Wait for the new deployment to become Active** — an in-progress / failed build still serves the previous instance.

### Build fails: `Failed to read app source directory`

This is a Railway builder/source issue (often wrong Root Directory or a bad Nixpacks snapshot). Fix in order:

1. **crm** service → **Settings → Source**
   - Repo: `yashas90/crm`
   - Branch: `main`
   - **Root Directory: leave blank** (not `apps/web`, not `apps/api`)
2. **Settings → Variables** → add `NO_CACHE=1` temporarily → **Deploy** latest commit (not Redeploy on the failed row).
3. **Settings → Build → Builder must be Dockerfile**
   - If Build Logs show `using build driver nixpacks-v1…` and `FROM ghcr.io/railwayapp/nixpacks:…`, the dashboard is **overriding** `railway.toml` and ignoring the repo `Dockerfile`.
   - Set Builder to **Dockerfile**, Dockerfile path `Dockerfile`, then Deploy latest `main`.
   - Success looks like: `FROM node:22-bookworm-slim` and `Baked deploy identity { version: '0.0.8', ... }`.
   - A green Nixpacks deploy that still serves `/health` without `deployMarker` is a **stale snapshot**, not an upgrade.
4. **Settings → Variables** → add `NO_CACHE=1` temporarily → **Deploy** latest commit (not Redeploy on an old/failed row).
5. If Nixpacks is still selected or the same ~6MB snapshot hash keeps coming back: rename the service or create a new service from the same repo/Postgres and move the public domain.

If Deploy logs show `@propninja/api@0.0.0 start`, that container is **not** current `main` (which is `0.0.8+`). Do not treat it as a successful upgrade — check Deployments → **Active** commit SHA and remove any stuck old deployment still bound to the public domain.

In Build logs you must see `Baked deploy identity { version: '0.0.8', deployMarker: 'nixpacks-guard-2026-08-21', ... }`. If that line is missing, the Dockerfile bake step did not run.

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
| `SENTRY_DSN_WEB` | Sentry browser + server DSN (optional) |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source map upload (optional) |
| `SENTRY_ORG` | Sentry org slug (required when uploading source maps) |
| `SENTRY_PROJECT` | Sentry project slug (required when uploading source maps) |

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
- [ ] Optional: Sentry receiving test errors (`GET /api/sentry-test` on web with admin JWT); Redis connected if using `REDIS_URL`
- [ ] Security checklist complete — [docs/pre-launch-security.md](docs/pre-launch-security.md)

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

### Force-update (block old APKs)

The API defaults `MIN_MOBILE_APP_VERSION` to **1.0.7** (current supported APK). Older installs
receive `APP_UPDATE_REQUIRED` and a blocking “Update required” screen.

After each new APK:

1. Bump `version` in `apps/mobile/app.config.ts`.
2. Build and distribute the APK.
3. Raise `MIN_MOBILE_APP_VERSION` on Railway to match (or bump the code default).
4. Set `MOBILE_UPDATE_URL` to `https://www.ninjamarketing.in/download` (public install page).
5. Set `NEXT_PUBLIC_MOBILE_APK_URL` on Vercel to the hosted APK download link.
6. Redeploy the API and web app.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Web CORS errors | Add exact origin(s) to API `CORS_ORIGINS` (no trailing slash) |
| `AUTH_JWT_SECRET` boot error | Set on API service, min 16 characters |
| `column "username" does not exist` | Migrations not applied — redeploy API or run `pnpm db:migrate` |
| 502 on Railway/Render | Check deploy logs; confirm `PORT` is provided by platform (Railway sets it automatically) |
| Vercel build fails on workspace | Ensure install/build commands in `vercel.json` run from monorepo root |
