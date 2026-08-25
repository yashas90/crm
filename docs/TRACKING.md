# Agent Location & Call Log Tracking

Production module for PropNinja CRM. Stack: Hono + Drizzle/PostgreSQL + BullMQ (optional Redis) + Expo mobile + Next.js admin.

## Environment variables

```env
TRACKING_TIMEZONE=Asia/Kolkata
TRACKING_START_TIME=09:30
TRACKING_END_TIME=20:30
TRACKING_INTERVAL_MINUTES=30
TRACKING_RETENTION_DAYS=14
TRACKING_MISSING_ALERT_MINUTES=45
```

## API endpoints

Mounted under `/api/locations` (existing auth JWT):

| Method | Path | Who |
|--------|------|-----|
| GET | `/config` | Authenticated |
| POST | `/ping` | Agent (idempotent `eventId`) |
| POST | `/ping/bulk` | Agent |
| POST | `/device` | Agent device heartbeat |
| POST | `/call-logs/bulk` | Agent (OS metadata) |
| GET | `/live` | Admin |
| GET | `/history?userId=&date=` | Admin (+ gaps) |
| GET | `/call-logs?userId=&date=` | Admin (masked phones) |

## Database

Migration: `packages/db/migrations/0056_agent_tracking_module.sql`

- Extends `agent_locations` with `event_id`, device/battery/network/source/speed/heading/altitude
- `agent_devices` — permission + tracking status
- `agent_call_logs` — OS call metadata (not audio)
- `tracking_audit_logs` — admin access audit

## Jobs

- `purge-expired-tracking` — daily (BullMQ every 24h when Redis set; in-process fallback)
- Deletes location + call-log rows older than `TRACKING_RETENTION_DAYS`

## Mobile

- Background location via Expo TaskManager + Android foreground service notification
- Target cadence every 30 minutes; catch-up GPS ping if last upload is ≥25 minutes old
- Restarts the native location task if no ping lands within 35 minutes (OS stall recovery)
- Collects only 09:30–20:30 IST Mon–Sun
- Offline queue with unique `eventId`
- Android: `READ_CALL_LOG` + `CallLogModule.getRecentCalls` (14-day initial / cursor sync)
- iOS: call-log status `UNAVAILABLE` (CRM dialer logs remain)

## Admin UI

- `/locations` — live status, map, permission/battery
- `/locations/history` — path, gaps, device call metadata, CRM dialer calls

## Known limitations

### Android

- Do-not-disturb / battery optimization / force-stop can delay or stop background pings
- Fused location / WorkManager-style OS scheduling has multi-minute tolerance around 30 minutes
- `READ_CALL_LOG` is Play-policy sensitive; sideload / enterprise distribution must stay disclosed
- Background location requires “Allow all the time”

### iOS

- Background location requires Always permission + Background Modes; OS may coalesce updates
- **No OS call-log API** for third-party apps — status is `CALL_LOG_PERMISSION_UNAVAILABLE` / `UNAVAILABLE`
- App termination and Low Power Mode limit update frequency

### Testing note

Background location and OS call-log harvest are unit-tested in CI; full end-to-end background behaviour must be verified on physical devices before claiming production readiness of those paths.

## Deployment

1. Set tracking env vars on the API (Railway).
2. Run `pnpm db:migrate` (applies `0056_agent_tracking_module`).
3. Deploy API + web.
4. Ship a new mobile build so agents get schedule gate + call-log sync native method.
5. Confirm Redis if you want BullMQ durable scheduling (optional; in-process timer also runs).
