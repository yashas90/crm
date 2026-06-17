# SQL audit — `apps/api/src`

Audit date: 2026-06-17

## Summary

PropNinja API uses **Drizzle ORM** for almost all database access. User-supplied values are passed through Drizzle placeholders (`${value}` inside `` sql`...` `` or query builder methods like `eq()`, `ilike()`), which PostgreSQL binds as parameters — not string concatenation.

| Category | Count | Action |
|----------|-------|--------|
| `db.execute(sql\`...\`)` | 2 prod + 2 test | Documented — static SQL only |
| Drizzle `` sql`...${var}...` `` | ~80+ | Parameterised ✓ (reviewed) |
| Unsafe string interpolation in SQL | 1 | **Fixed** (`adLeadFilters.ts`) |
| `.run(` / `.all(` (sqlite-style) | 0 | N/A |

## `db.execute()` call sites

### `apps/api/src/routes/health.ts`

```typescript
db.execute(sql`select 1`); // parameterised ✓ — static health probe, no user input
```

### `apps/api/src/__tests__/api.performance.test.ts`

Test-only setup/teardown SQL. Not exposed in production routes.

## Fixed: unsafe literal interpolation

### `apps/api/src/lib/adLeadFilters.ts` (fixed)

**Before:** `` sql`'${AD_LEAD_TAG}' = ANY(...)` `` — tag embedded in SQL text literal.

**After:** `` sql`${AD_LEAD_TAG} = ANY(COALESCE(${leads.tags}, ARRAY[]::text[]))` `` — tag bound as query parameter via Drizzle.

## Drizzle `sql` template usage (parameterised ✓)

The following files use `` sql`...` `` with `${column}` or `${value}` placeholders. Drizzle converts `${value}` bindings to `$1`, `$2`, … parameters. Column references (`${leads.phone}`) are schema identifiers, not user input.

| File | Notes |
|------|-------|
| `services/leadService.ts` | Phone normalisation, duplicate detection, tag filters — all parameterised ✓ |
| `services/reportService.ts` | Report aggregations; search uses `ilike()` with bound patterns ✓ |
| `services/analyticsService.ts` | KPI date ranges via `` sql`${range.dateFrom}::date` `` — bound dates ✓ |
| `services/notificationService.ts` | JSON payload filters — bound leadId / followupAt ✓ |
| `services/taskService.ts` | CASE ordering — column refs only ✓ |
| `services/auditService.ts` | Entity existence checks — static fragments ✓ |
| `services/projectUnitService.ts` | Unit overlap filters — bound UUIDs ✓ |
| `services/projectService.ts` | Name comparison via `lower(${projects.name}) = lower(${name})` — bound ✓ |
| `services/reportEmailService.ts` | Scheduled report aggregations ✓ |
| `services/leadScoringService.ts` | Active lead filter ✓ |
| `services/siteVisitService.ts` | Date window filters ✓ |
| `lib/adLeadFilters.ts` | Ad lead tag filter (fixed) ✓ |

## Search / filter patterns

- **Leads list:** All query params validated through `listLeadsQuerySchema` (Zod) before reaching `leadService.listLeads()`. No raw query strings hit SQL.
- **Reports:** `reports` validators coerce dates and enums; `ilike()` patterns built from validated strings.
- **Calls:** `listCallsQuerySchema` validates list filters; log body via `logCallBodySchema`.

## Recommendations

1. Keep all new queries on Drizzle builders or `` sql`...${param}` `` — never template user input into SQL strings.
2. Add integration tests when introducing new raw `sql` fragments.
3. Re-run this audit when adding `db.execute()` or ORM bypasses.

## Web XSS (related)

- No `dangerouslySetInnerHTML` in `apps/web/src` (verified 2026-06-17).
- Lead notes render as React text nodes with `whitespace-pre-wrap` — not HTML.
- No rich-text editor; DOMPurify not required at this time.
