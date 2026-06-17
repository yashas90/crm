# Region migration — US → Mumbai (India)

PropNinja CRM's primary users are in **Bengaluru, India**. The production API on Railway US (`sfo` / US West) adds **~200–280 ms round-trip** per request before Postgres or application code runs.

Moving **Railway (API + Postgres)** to **Mumbai (`ap-south-1`)** and **Vercel serverless functions** to **`bom1`** cuts that overhead to roughly **30–60 ms** from Indian networks.

Related: [ENV_VARS.md](./ENV_VARS.md) · [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) · [DEPLOY.md](../DEPLOY.md) · [BACKUP_SETUP.md](./BACKUP_SETUP.md)

---

## Target architecture

| Component | Region | Identifier |
|-----------|--------|------------|
| Railway API | **Mumbai (India)** | `ap-south-1` (dashboard may show **India**) |
| Railway Postgres | **Same project / Mumbai** | API ↔ DB must stay in-region (internal `DATABASE_URL`) |
| Vercel functions | **Mumbai (`bom1`)** | Next.js middleware / server routes |
| Vercel static assets | Edge (automatic) | CDN PoPs in India — no change needed |
| Cloudflare R2 | **`apac` location hint** | Document uploads/downloads closer to India |
| Mobile (EAS) | N/A | Points at Railway public URL — rebuild after API cutover |

### Latency targets (Indian mobile / office network)

| Metric | Target | Acceptable | Action if exceeded |
|--------|--------|------------|-------------------|
| `/health` total time | **< 50 ms** | 50–100 ms | Check Railway region is Mumbai, not US/Singapore |
| `/health` total time | — | **> 100 ms** | Check [Railway status](https://status.railway.app); verify region in dashboard |

---

## Production URLs (update after cutover)

| Role | URL |
|------|-----|
| **Old (US)** | `https://crm-production-6cfe.up.railway.app` |
| **New (Mumbai)** | `https://crm-production-e81d.up.railway.app` *(project: `propninja-crm-mumbai`)* |

> **Region check:** After creating services, open Railway → each service → **Settings → Deploy → Region** and confirm **India / Mumbai (`ap-south-1`)**. If services show `sfo` or `us-west`, change region **before** loading production data (Postgres volume migration causes downtime).

---

## Before you start

1. Schedule a **maintenance window** (30–60 minutes).
2. Export a fresh backup ([BACKUP_SETUP.md](./BACKUP_SETUP.md)).
3. Inventory every place the API URL appears:
   - Railway public domain
   - Vercel `NEXT_PUBLIC_API_URL` / `API_URL`
   - `apps/mobile/eas.json` → `EXPO_PUBLIC_API_URL`
   - Meta / Google webhook URLs
   - UptimeRobot ([UPTIME_MONITORING.md](./UPTIME_MONITORING.md))
4. Copy every variable from [ENV_VARS.md](./ENV_VARS.md) into the new Railway project.

---

## 1. Railway — new Mumbai project

### Dashboard (recommended for region selection)

1. [Railway](https://railway.app) → **Account Settings → Preferred Region** → **India / Mumbai** (`ap-south-1`).
2. **New Project** → **Deploy from GitHub** → `yashas90/crm` (branch `main`).
3. Add **PostgreSQL** — confirm region is **Mumbai** on the Postgres service.
4. Add **crm** API service (reads root `railway.toml`):
   - Build: `pnpm install && pnpm railway:build`
   - Start: `pnpm db:migrate && pnpm --filter @propninja/api start`
   - Health check: `/health`
5. Set region on **crm** service → **India / Mumbai**.
6. Copy environment variables (see checklist below). Link Postgres:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   ```
7. Set CORS:
   ```
   CORS_ORIGINS=https://www.ninjamarketing.in,https://ninjamarketing.in
   ```
8. Do **not** cut over traffic until database restore completes (step 2).

### CLI bootstrap (project already created)

A staging project **`propninja-crm-mumbai`** exists with Postgres + `crm` service. If its region is not Mumbai:

1. Dashboard → **propninja-crm-mumbai** → **Postgres** → Settings → Deploy → Region → **India / Mumbai** (volume migration — expect brief downtime).
2. Repeat for **crm** service.
3. Or delete the project and recreate after setting **Preferred Region** to Mumbai.

```bash
mkdir propninja-mumbai-setup && cd propninja-mumbai-setup
railway init --name propninja-crm-mumbai
railway add --database postgres
railway add --repo yashas90/crm --branch main --service crm
railway domain   # note the *.up.railway.app URL
```

### Environment variables to copy

Copy **every** variable from the US **crm** service per [ENV_VARS.md](./ENV_VARS.md). Minimum:

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` from **new** Mumbai Postgres |
| `AUTH_JWT_SECRET` | Same as US (or rotate → all users re-login) |
| `ALLOW_DEMO_AUTH` | `false` |
| `CORS_ORIGINS` | `https://www.ninjamarketing.in,https://ninjamarketing.in` |
| `SENTRY_DSN` | Same DSN |
| `RESEND_*`, `WEB_APP_URL` | Password reset emails |
| `META_*`, `GOOGLE_ADS_*` | Integrations |
| `CLOUDFLARE_R2_*` | Documents |
| `REDIS_URL` | If used |
| `HEALTH_ADMIN_TOKEN` | Monitoring |
| `API_PUBLIC_URL` | New Mumbai public URL |

Do **not** copy `RAILWAY_*` or `NEXT_PUBLIC_API_URL` onto the API service (Vercel/mobile only).

---

## 2. Postgres migration (US → Mumbai)

Railway has no one-click cross-region DB transfer. Use `pg_dump` / `pg_restore`.

### Prerequisites

- PostgreSQL client tools (`pg_dump`, `psql`, `pg_restore`) on your machine, **or** run from GitHub Actions / a Linux VM.
- [Railway CLI](https://docs.railway.com/develop/cli) logged in.

### Automated script

From repo root (requires `pg_dump` / `pg_restore` on PATH):

```bash
# Link source (US), dump
cd /path/to/propninjacrm
railway link   # select propninja-crm (US)
bash scripts/migrate-db-railway.sh dump

# Link target (Mumbai), restore
cd /path/to/propninja-mumbai-setup
railway link   # select propninja-crm-mumbai
bash ../propninjacrm/scripts/migrate-db-railway.sh restore
```

### Manual steps

#### 2a. Dump from US database

```bash
railway link   # US project: propninja-crm
railway service link crm

# Public URL for external pg_dump (from Postgres service variables)
pg_dump "$DATABASE_PUBLIC_URL" -Fc -f propninja-us-$(date +%Y%m%d).dump
```

Store the dump securely. **Never commit to git.**

#### 2b. Restore to Mumbai database

```bash
railway link   # Mumbai project: propninja-crm-mumbai
railway service link Postgres

pg_restore -d "$DATABASE_PUBLIC_URL" \
  -v --clean --if-exists --no-owner --no-acl propninja-us-YYYYMMDD.dump
```

Plain SQL alternative:

```bash
pg_dump "$US_DATABASE_PUBLIC_URL" > backup.sql
psql "$MUMBAI_DATABASE_PUBLIC_URL" < backup.sql
```

#### 2c. Verify row counts

On **both** projects:

```bash
railway connect Postgres
```

```sql
SELECT COUNT(*) FROM leads;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM call_records;
```

Counts must match before cutover.

#### 2d. Deploy API in Mumbai

1. Redeploy **crm** after env vars are set.
2. Confirm health:
   ```bash
   curl -s https://crm-production-e81d.up.railway.app/health
   ```
   Expected: `{ "status": "ok", "db": "ok", ... }`

---

## 3. Vercel — Mumbai functions

### Dashboard

1. Vercel → **crm-api** (web) project → **Settings → Functions**.
2. **Function region** → **Mumbai (`bom1`)**.
3. Update environment variables:
   - `NEXT_PUBLIC_API_URL=https://crm-production-e81d.up.railway.app`
   - `API_URL=https://crm-production-e81d.up.railway.app` *(if set)*
4. **Redeploy** production.

### Repo (enforced in code)

`apps/web/vercel.json` includes:

```json
"regions": ["bom1"]
```

---

## 4. Mobile app

After the Mumbai Railway URL is verified:

1. Edit `apps/mobile/eas.json` → `EXPO_PUBLIC_API_URL` in **preview** and **production**.
2. Edit `apps/mobile/app.config.ts` → `PRODUCTION_API_URL`.
3. Re-extract SSL pins if the hostname changed:
   ```bash
   node scripts/mobile-extract-cert-pin.js crm-production-e81d.up.railway.app
   ```
4. Rebuild:
   ```bash
   cd apps/mobile
   eas build --platform android --profile production
   eas build --platform ios --profile production
   ```

Agents must install the new build before you delete the US project.

---

## 5. Cutover checklist

- [ ] Railway **crm** + **Postgres** region = **Mumbai / India (`ap-south-1`)**
- [ ] `GET /health` → 200, `"db": "ok"` on **new** URL
- [ ] Row counts match US dump
- [ ] Vercel function region = **`bom1`**
- [ ] `NEXT_PUBLIC_API_URL` / `API_URL` → new Mumbai URL
- [ ] `CORS_ORIGINS` includes production web origins
- [ ] Meta / Google webhook URLs updated to new host
- [ ] UptimeRobot monitors → new `/health` URL
- [ ] Latency from Indian network: **< 50 ms** on `/health`
- [ ] Smoke test: web login → create lead → mobile call log → report shows call
- [ ] EAS production build with new `EXPO_PUBLIC_API_URL`

### Latency verification

From an **Indian mobile or office network** (not US VPN):

```bash
curl -w "Total time: %{time_total}s\n" -o /dev/null -s \
  https://crm-production-e81d.up.railway.app/health
```

Or:

```bash
API_URL=https://crm-production-e81d.up.railway.app bash scripts/latency-check.sh
```

### Expected improvement (Bengaluru agents)

| Route | Before (US) | After (Mumbai) |
|-------|-------------|----------------|
| Single `/health` | 200–280 ms | **30–60 ms** |
| Leads list (5 API calls) | 1–1.4 s network overhead | **150–300 ms** overhead |

---

## 6. UptimeRobot

Update monitors in [UPTIME_MONITORING.md](./UPTIME_MONITORING.md):

- Primary: `https://crm-production-e81d.up.railway.app/health`
- Detailed (if used): `https://crm-production-e81d.up.railway.app/api/health/detailed`

Keep the old US URL monitor until cutover is confirmed, then remove it.

---

## 7. Decommission US project

Delete **`propninja-crm`** (US) **only after**:

- [ ] Mumbai deploy stable for **24 hours**
- [ ] At least **2 agents** tested mobile with no errors
- [ ] Sentry shows no new errors from Mumbai deployment
- [ ] Vercel confirmed pointing to Mumbai API

---

## 8. Rollback

1. Revert Vercel `NEXT_PUBLIC_API_URL` to `https://crm-production-6cfe.up.railway.app`.
2. Point Meta/Google webhooks back to US API.
3. Keep Mumbai project for investigation; do not delete US until resolved.
4. Restore Postgres from latest US backup if restore corrupted data.

---

## Fallback: Singapore

If **India / Mumbai** does not appear in your Railway dashboard, use **Southeast Asia (Singapore)** — `asia-southeast1-eqsg3a` / CLI `southeast-asia`. Vercel fallback region: **`sin1`**. Expected `/health` from India: **~60–80 ms** (still far better than US).

---

## QA-016

Resolves **QA-016** (API latency ~276 ms from India). Mark **RESOLVED** in [QA_FINAL_REPORT.md](./QA_FINAL_REPORT.md) after Mumbai latency and smoke tests pass.
