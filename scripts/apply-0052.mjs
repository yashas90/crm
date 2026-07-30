import fs from "node:fs";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const ddl = fs.readFileSync("packages/db/migrations/0052_meta_form_assignees.sql", "utf8");
  await sql.unsafe(ddl);
  const cols = await sql`
    select column_name
    from information_schema.columns
    where table_name = 'facebook_forms'
      and column_name in ('assignee_ids', 'assignment_strategy', 'last_assigned_index')
    order by 1
  `;
  console.log(JSON.stringify({ ok: true, cols }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
