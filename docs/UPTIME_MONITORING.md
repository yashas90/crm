# Uptime monitoring setup

External uptime checks alert the team when the API or marketing site is unreachable. PropNinja uses **UptimeRobot** (free tier) for HTTP monitoring.

Related: [BACKUP_SETUP.md](./BACKUP_SETUP.md) · [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md)

---

## 1. Sign up

1. Go to [uptimerobot.com](https://uptimerobot.com) and create a free account.
2. Confirm your email address.

The free plan supports 50 monitors with **5-minute** check intervals.

---

## 2. Alert contacts

Before adding monitors, configure notifications:

1. **My Settings** → **Alert Contacts** → **Add Alert Contact**
2. Add **Email** — admin/ops address.
3. Add **SMS** and/or **WhatsApp** (UptimeRobot supports SMS natively; WhatsApp may be available via SMS gateway or third-party integration depending on your region — configure both email and mobile alert paths).
4. Complete verification for each contact.

Assign **all monitors** to admin **email** and **WhatsApp/SMS** contacts.

---

## 3. Monitor — PropNinja API

Public health endpoint (no auth):

| Field | Value |
|-------|--------|
| Monitor type | **HTTP(s)** |
| Friendly name | `PropNinja API` |
| URL | `https://crm-production-e81d.up.railway.app/health` *(after Mumbai cutover)* |
| Monitoring interval | **5 minutes** |
| Alert contacts | Admin email + WhatsApp/SMS |

**Expected response:** HTTP `200` with JSON containing `"status":"ok"` and `"db":"ok"`.

Optional keyword alert: `"status":"ok"`.

---

## 4. Monitor — Marketing website

| Field | Value |
|-------|--------|
| Monitor type | **HTTP(s)** |
| Friendly name | `Ninja Marketing Web` |
| URL | `https://www.ninjamarketing.in` |
| Monitoring interval | **5 minutes** |
| Alert contacts | Admin email + WhatsApp/SMS |

**Expected response:** HTTP `200` (homepage loads).

---

## 5. Optional — Detailed API health (internal)

For DB latency and process uptime, use the admin-token endpoint:

| Field | Value |
|-------|--------|
| URL | `https://crm-production-6cfe.up.railway.app/api/health/detailed` |
| Header | `Authorization: Bearer <HEALTH_ADMIN_TOKEN>` |
| Expected | `200`, `"dbConnected": true` |

Set `HEALTH_ADMIN_TOKEN` on the Railway **crm** API service (see `apps/api/.env.example`). Rotate if leaked.

```bash
curl -s -H "Authorization: Bearer $HEALTH_ADMIN_TOKEN" \
  https://crm-production-6cfe.up.railway.app/api/health/detailed
```

Example response:

```json
{
  "status": "ok",
  "dbConnected": true,
  "dbLatencyMs": 12,
  "uptime": 86400,
  "version": "1.0.0",
  "environment": "production"
}
```

---

## 6. Verify from outside your network

```bash
curl -s https://crm-production-6cfe.up.railway.app/health
curl -s -o /dev/null -w "%{http_code}\n" https://www.ninjamarketing.in
```

Both should return `200`. Confirm UptimeRobot shows **Up** within one check interval.

---

## 7. Incident response (quick reference)

| Alert | First steps |
|-------|-------------|
| API down | Railway dashboard → crm service logs & deploy status |
| DB degraded (`"db":"error"` on `/health`) | Check Postgres service; Railway status page |
| Web down | Vercel deploy & domain DNS |

If data loss is suspected, see [BACKUP_SETUP.md](./BACKUP_SETUP.md).
