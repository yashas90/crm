# Agent Location, Call Log & Tracking Health

Extends the core tracking module with device health, heartbeats, alerts, and admin monitoring.

## Architecture (short)

- Mobile registers device + sends ~15 min heartbeats + ~30 min location during 09:30–20:30 IST
- GPS is captured even offline (queued locally, up to 500 pings) and flushed with backoff
- Android FGS + boot receiver + WorkManager keep tracking alive across reboot / OEM kills
- API upserts `agent_devices`, stores last-known location, evaluates health, opens alerts
- Admins get CRM notifications (`tracking_alert`) + `/locations/alerts`
- Retention job writes `tracking_cleanup_runs` audit (counts only)

## Status (admin live map)

| Status | Meaning |
|--------|---------|
| ACTIVE | Tracking enabled; not uninstalled. Last-known pin if GPS is older than 45 *tracking-hours* minutes |
| PAUSED | Outside 09:30–20:30 IST — overnight gap is never STALE |
| STALE | Likely uninstalled: 24h+ no ping, no boot event, no queued offline pings |
| OFFLINE | Tracking disabled for the agent |

Phone off, no internet, force-stop, missing Always permission, and night hours must **not** show STALE.

## New env vars

```env
TRACKING_ENABLED=true
TRACKING_HEARTBEAT_THRESHOLD_MINUTES=60
TRACKING_POSSIBLE_UNINSTALL_MINUTES=1440
```

(Plus existing `TRACKING_TIMEZONE`, `START/END`, `INTERVAL`, `RETENTION`, `MISSING_ALERT`.)

## New endpoints

| Method | Path | Who |
|--------|------|-----|
| GET | `/api/locations/me/status` | Agent self-status |
| POST | `/api/locations/device/heartbeat` | Lightweight heartbeat (boot + offline queue counts) |
| GET | `/api/locations/health` | Admin health table |
| GET | `/api/locations/alerts` | Admin open alerts |
| GET/PATCH | `/api/locations/settings` | Admin org settings |
| POST | `/api/locations/agents/:id/enable\|disable` | Admin policy |

## Admin UI

- `/locations` — live + **Last known location** when GPS is old; **Paused** overnight; **Stale** only if likely uninstalled
- `/locations/health` — health table + enable/disable
- `/locations/alerts` — open alerts
- `/locations/settings` or `/settings/tracking` — schedule/thresholds

## Mobile

- Hard gate: Allow all the time + Android call log + Android ignore battery optimizations
- After 3 denied location prompts, admins are notified
- iOS Low Power Mode is a warning only (OS cannot disable it)
- Heartbeat loop while app process is alive (15 min when foreground)
- Closed-app BackgroundFetch watchdog + Android WorkManager every 30 min
- BootCompleted receiver restarts the location FGS
- 09:30 / 20:30 IST AlarmManager (Android) to resume/keep-alive
- Device registration includes installationId + model/OS + lastBootAt + queued ping count

## Jobs

- `tracking-health-eval` every 15 minutes
- `purge-expired-tracking` daily + cleanup run audit

## Honest limitations

- Uninstall cannot be proven without MDM — STALE means 24h silence with no boot/queue explanation
- iOS cannot restart after a user force-stop; significant-change (~500m) relaunches when the device moves
- Android force-stop also blocks receivers until the next boot or the user opens the app
- Background behaviour must be verified on physical devices before calling production-ready
