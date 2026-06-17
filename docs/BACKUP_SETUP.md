# Railway Postgres backup setup

PropNinja CRM production database runs on **Railway Postgres**. Enable automated backups before go-live and verify restores monthly.

> **Monthly reminder:** Test backup restore every month (staging or a throwaway Railway service).

Related: [UPTIME_MONITORING.md](./UPTIME_MONITORING.md) · [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md)

---

## 1. Enable Railway daily backups

1. Open [Railway](https://railway.com) → your **PropNinja** project.
2. Select the **Postgres** service (database plugin, not the API service).
3. Go to **Settings** → **Database** → **Backups** (or open the **Backups** tab on the Postgres service).
4. Click **Edit Schedule** (top right of the Backups panel).
5. Enable the **Daily** schedule:
   - Runs every **24 hours**
   - Railway retains daily backups for **6 days** (closest built-in option to a **7-day** retention target)
6. Save the schedule.

Backups are **not** enabled by default — you must turn them on manually.

### Verify

- After the first scheduled run, confirm a new backup appears in the Backups list with a recent timestamp.
- Optionally click **Create backup** once to confirm manual backups work before relying on the schedule.

---

## 2. Retention (7 days)

| Schedule | Railway retention | Use for |
|----------|-------------------|---------|
| **Daily** | 6 days | Primary — meets “~7 day” recovery window |
| Weekly | ~1 month | Extra safety net |
| Monthly | ~3 months | Long-term archive |

For PropNinja production, enable **Daily** at minimum.

---

## 3. Restore from a backup

### Option A — Railway dashboard (recommended)

1. Railway → **Postgres** service → **Backups**.
2. Find the backup by **date stamp** and click **Restore**.
3. Railway stages a **new volume** alongside the old one (the old volume is unmounted but kept).
4. Review the staged change on the project canvas → **Details**.
5. Confirm data (e.g. `railway connect Postgres` or run `SELECT 1`).
6. Click **Deploy** to finalize the restore.

**Important:** Restoring removes backups **newer** than the one you selected. Re-enable the backup schedule on the active volume if needed.

Docs: [Railway volume backups](https://docs.railway.com/volumes/backups)

### Option B — Railway CLI + `pg_restore` (restore drill)

Use this to practice recovery or load a dump into **staging** without replacing production.

**Prerequisites:** [Railway CLI](https://docs.railway.com/develop/cli), PostgreSQL client tools (`pg_dump`, `pg_restore`).

```bash
# Link to the PropNinja project
railway link

# Open an interactive psql session (inspect data)
railway connect Postgres

# Dump production (replace Postgres with your service name if different)
pg_dump "$(railway variables --service Postgres --kv | grep '^DATABASE_PUBLIC_URL=' | cut -d= -f2-)" \
  -Fc -f propninja-backup.dump

# Restore into a TARGET database (staging only — not production unless intended)
pg_restore -d "$TARGET_DATABASE_URL" -v --clean --if-exists propninja-backup.dump
```

---

## 4. Pre-go-live checklist

- [ ] Daily backup schedule enabled on production Postgres
- [ ] At least one manual backup completed successfully
- [ ] Restore drill performed on **staging** (dashboard or `pg_restore`)
- [ ] Team knows who can access Railway and approve a production restore

---

## 5. Monthly operations

<!-- TODO: Test backup restore every month -->

- [ ] **Test backup restore every month** — restore latest backup to staging and run smoke tests (`GET /health`, login, list leads).
- [ ] Confirm backup schedule is still enabled after any volume restore or Postgres replacement.
- [ ] Store manual `pg_dump` off Railway quarterly if you need retention longer than 6 days.
