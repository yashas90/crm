# Query performance notes

## Connection pool (`apps/api/src/lib/db.ts`)

- `max: 10` — leaves headroom on Railway Hobby (25 connection limit)
- `min: 2` — warmed on startup
- `idle_timeout: 30s`

## Slow query logging (development)

When `NODE_ENV=development` and a query exceeds **200ms**, the API logs the `EXPLAIN (ANALYZE, BUFFERS)` plan via `logger.warn('Slow database query', ...)`.

## Indexes (migration `0029_performance_indexes`)

| API field | Column | Index |
|-----------|--------|-------|
| `assignedTo` | `leads.assigned_to` | `leads_assigned_to_idx` |
| `stage` | `leads.lead_status` | `leads_lead_status_idx` |
| `source` | `leads.lead_source` | `leads_lead_source_idx` |
| `createdAt` | `leads.created_at` | `leads_created_at_idx` |
| `nextFollowUpAt` | `leads.next_followup_at` | `leads_next_followup_at_idx` |
| `lastContactedAt` | `leads.last_contacted_at` | `leads_last_contacted_at_idx` |
| Agent + date | `(assigned_to, created_at)` | `leads_assigned_to_created_at_idx` |
| Pipeline + agent | `(lead_status, assigned_to)` | `leads_lead_status_assigned_to_idx` |
| `agentId` | `call_records.user_id` | `call_records_user_id_idx` |
| `leadId` | `call_records.lead_id` | `call_records_lead_id_idx` |
| `calledAt` | `call_records.started_at` | `call_records_started_at_idx` |
| `outcome` | `call_records.outcome` | `call_records_outcome_idx` |
| Agent history | `(user_id, started_at)` | `call_records_user_id_started_at_idx` |
| `assigneeId` | `tasks.assigned_to` | `tasks_assigned_to_idx` (0014) |
| `dueAt` | `tasks.due_at` | `tasks_due_at_idx` (0014) |
| `status` | `tasks.status` | `tasks_status_idx` (0014) |
| Open tasks | `(assigned_to, status)` | `tasks_assigned_to_status_idx` |
| Site visits | `(agent_id, visit_date)`, `status` | `0018` indexes |
| Unread | `(user_id, is_read)` | `notifications_user_id_unread_idx` |

## Pagination

All list endpoints (leads, calls, tasks, site visits, notifications, documents) enforce **default pageSize 50**, **max 500**, and return `total` for client pagination.

## Performance tests

```bash
pnpm --filter @propninja/db migrate
pnpm --filter @propninja/api test src/__tests__/api.performance.test.ts
```

Seeds 10,000 leads + 50,000 calls and asserts:

- `GET /api/leads` &lt; **300ms**
- `GET /api/analytics/overview` &lt; **2000ms**

## Server-side response cache

In-memory cache via `node-cache` (`apps/api/src/lib/responseCache.ts`). Keys: `{route}#{userId|orgId}#{queryHash}`.

| Route | TTL |
|-------|-----|
| `GET /api/analytics/overview` | 5 min |
| `GET /api/reports/*` (not exports) | 5 min |
| `GET /api/reports/agent-stats` | 10 min |
| `GET /api/projects*` | 10 min |
| `GET /api/documents*` | 5 min |
| `GET /api/org` | 30 min |

Never cached: leads, calls, notifications.

- `POST /api/analytics/overview/refresh` — busts analytics cache for the current user
- `POST /api/admin/cache/clear` — admin-only full cache flush

HTTP headers: `Cache-Control: private, max-age=300` (org/projects); reports/analytics include `stale-while-revalidate=60`.
