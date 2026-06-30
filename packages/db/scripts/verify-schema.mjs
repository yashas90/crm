import postgres from "postgres";

const EXPECTED_MIGRATION_COUNT = 44;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: url.includes("railway") ? "require" : undefined });

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'lead_import_batches',
      'lead_import_batch_items',
      'pipeline_stages',
      'auth_refresh_sessions'
    )
  ORDER BY table_name
`;

const leadCols = await sql`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'leads'
    AND column_name IN ('sub_status', 'close_reason')
  ORDER BY column_name
`;

const migCount = await sql`
  SELECT COUNT(*)::int AS count FROM drizzle.__drizzle_migrations
`;

const recentMigs = await sql`
  SELECT id, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 8
`;

const trgm = await sql`
  SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'
`;

const migrationCount = migCount[0]?.count ?? 0;
const report = {
  ok:
    tables.length === 4 &&
    leadCols.length === 2 &&
    migrationCount === EXPECTED_MIGRATION_COUNT &&
    trgm.length === 1,
  tables: tables.map((r) => r.table_name),
  leadColumns: leadCols.map((r) => r.column_name),
  migrationCount,
  expectedMigrationCount: EXPECTED_MIGRATION_COUNT,
  migrationCountOk: migrationCount === EXPECTED_MIGRATION_COUNT,
  pgTrgmEnabled: trgm.length === 1,
  recentMigrationIds: recentMigs.map((r) => r.id),
};

console.log(JSON.stringify(report, null, 2));

await sql.end();
process.exit(report.ok ? 0 : 1);
