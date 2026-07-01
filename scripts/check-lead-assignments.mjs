import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: url.includes("railway") ? "require" : undefined });

const agents = await sql`
  SELECT id, email, name, is_active
  FROM users
  WHERE role = 'agent'
  ORDER BY email
  LIMIT 20
`;

const sample = await sql`
  SELECT l.id, l.first_name, l.last_name, l.assigned_to, l.deleted_at IS NOT NULL AS deleted,
         u.email AS assignee_email, u.name AS assignee_name
  FROM leads l
  LEFT JOIN users u ON l.assigned_to = u.id
  WHERE l.deleted_at IS NULL
  ORDER BY l.updated_at DESC
  LIMIT 10
`;

const [{ n: orphanAssignedTo }] = await sql`
  SELECT COUNT(*)::int AS n
  FROM leads l
  LEFT JOIN users u ON l.assigned_to = u.id
  WHERE l.deleted_at IS NULL AND l.assigned_to IS NOT NULL AND u.id IS NULL
`;

const [{ n: unassignedLeads }] = await sql`
  SELECT COUNT(*)::int AS n FROM leads WHERE deleted_at IS NULL AND assigned_to IS NULL
`;

console.log(JSON.stringify({ agents, sample, orphanAssignedTo, unassignedLeads }, null, 2));

await sql.end();
