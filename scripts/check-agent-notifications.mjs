import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: url.includes("railway") ? "require" : undefined });

const agentId = "0df1ce63-0d95-4d6e-8303-24b9b4c3bf84";

const unassigned = await sql`
  SELECT id, first_name, last_name, assigned_to
  FROM leads
  WHERE deleted_at IS NULL AND assigned_to IS NULL
`;

const visitsOnUnassigned = await sql`
  SELECT sv.id, sv.lead_id, sv.agent_id, l.first_name, l.assigned_to
  FROM site_visits sv
  JOIN leads l ON l.id = sv.lead_id
  WHERE l.assigned_to IS NULL AND sv.agent_id = ${agentId}
  LIMIT 10
`;

const recentNotifs = await sql`
  SELECT id, type, payload, is_read, created_at
  FROM notifications
  WHERE user_id = ${agentId}
  ORDER BY created_at DESC
  LIMIT 15
`;

console.log(JSON.stringify({ unassigned, visitsOnUnassigned, recentNotifs }, null, 2));

await sql.end();
