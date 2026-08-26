# Agent Location, Call Log & Tracking Health

Extends the core tracking module with device health, heartbeats, alerts, and admin monitoring.

## Architecture (short)

- Mobile registers device + sends ~15 min heartbeats + ~30 min location during 09:30–20:30 IST
- API upserts `agent_devices`, stores last-known location, evaluates health, opens alerts
- Admins get CRM notifications (`tracking_alert`) + `/locations/alerts`
- Retention job writes `tracking_cleanup_runs` audit (counts only)

## New env vars

```env
TRACKING_ENABLED=true
TRACKING_HEARTBEAT_THRESHOLD_MINUTES=60
TRACKING_POSSIBLE_UNINSTALL_MINUTES=180
```

(Plus existing `TRACKING_TIMEZONE`, `START/END`, `INTERVAL`, `RETENTION`, `MISSING_ALERT`.)

## New endpoints

| Method | Path | Who |
|--------|------|-----|
| GET | `/api/locations/me/status` | Agent self-status |
| POST | `/api/locations/device/heartbeat` | Lightweight heartbeat |
| GET | `/api/locations/health` | Admin health table |
| GET | `/api/locations/alerts` | Admin open alerts |
| GET/PATCH | `/api/locations/settings` | Admin org settings |
| POST | `/api/locations/agents/:id/enable\|disable` | Admin policy |

## Admin UI

- `/locations` — live + **Last known location** when stale
- `/locations/health` — health table + enable/disable
- `/locations/alerts` — open alerts
- `/locations/settings` or `/settings/tracking` — schedule/thresholds

## Mobile

- Profile → **Tracking status**
- Heartbeat loop while app process is alive (15 min when foreground)
- Closed-app BackgroundFetch watchdog heartbeats + catch-up GPS even when UI is not open
- Device registration includes installationId + model/OS (non-invasive)

## Jobs

- `tracking-health-eval` every 15 minutes
- `purge-expired-tracking` daily + cleanup run audit

## Honest limitations

- Uninstall cannot be proven without MDM — status is `POSSIBLE_APP_UNINSTALLED`
- Heartbeats stop when the OS kills the app; location FGS still preferred for background GPS
- Background behaviour must be verified on physical devices before calling production-ready
