import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: url.includes("railway") ? "require" : undefined });

const count = await sql`SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations`;
const recent = await sql`
  SELECT id, hash, created_at
  FROM drizzle.__drizzle_migrations
  ORDER BY id DESC
  LIMIT 12
`;

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('lead_import_batches', 'auth_refresh_sessions', 'pipeline_stages')
  ORDER BY table_name
`;

const cols = await sql`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'leads'
    AND column_name IN ('close_reason', 'sub_status')
  ORDER BY column_name
`;

const trgm = await sql`SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`;

console.log(
  JSON.stringify(
    {
      migrationCount: count[0]?.n ?? 0,
      recentMigrations: recent,
      tables: tables.map((r) => r.table_name),
      leadColumns: cols.map((r) => r.column_name),
      pgTrgm: trgm.length > 0,
    },
    null,
    2,
  ),
);

await sql.end();
