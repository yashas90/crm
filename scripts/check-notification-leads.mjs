import postgres from "postgres";

const url = process.env.DATABASE_URL;
const ids = [
  "84b6146e-db1b-4206-b63f-db26984720d3",
  "536c7aa0-6d4e-4759-be38-274da9fd4a1f",
  "8eee2e1c-f7f9-4b09-93e4-7eb542a0c909",
  "5d3346a9-a97e-4f84-aa42-c2e7ef7f32f5",
  "a2f8994d-dc79-44f0-b48f-0ca790e583c2",
  "c27bca59-cc5c-43fa-bc0f-f72edc38b8fe",
];

const sql = postgres(url, { max: 1, ssl: url.includes("railway") ? "require" : undefined });
const vinay = "0df1ce63-0d95-4d6e-8303-24b9b4c3bf84";

const rows = await sql`
  SELECT l.id, l.first_name, l.assigned_to, l.deleted_at IS NOT NULL AS deleted, u.email
  FROM leads l
  LEFT JOIN users u ON l.assigned_to = u.id
  WHERE l.id = ANY(${ids})
`;

for (const row of rows) {
  console.log(
    `${row.first_name}: assigned_to=${row.assigned_to ?? "NULL"} (${row.email ?? "none"}) deleted=${row.deleted} match_vinay=${row.assigned_to === vinay}`,
  );
}

await sql.end();
