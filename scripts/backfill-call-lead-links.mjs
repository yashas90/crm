/**
 * Link unlinked call_records to leads via last-10 digit phone match.
 * Fixes dial-pad logs stored as `9876…` against leads stored as `+919876…`.
 *
 * Usage: DATABASE_URL=... node scripts/backfill-call-lead-links.mjs
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });

const [{ before_unlinked }] = await sql`
  select count(*)::int as before_unlinked
  from call_records
  where lead_id is null
    and length(regexp_replace(coalesce(phone_number, ''), '[^0-9]', '', 'g')) >= 10
`;
console.log("BEFORE_UNLINKED_WITH_PHONE", before_unlinked);

const updated = await sql`
  with matched as (
    select distinct on (cr.id)
      cr.id as call_id,
      l.id as lead_id
    from call_records cr
    join leads l
      on l.org_id = cr.org_id
     and l.deleted_at is null
     and (
       l.phone_key = right(regexp_replace(coalesce(cr.phone_number, ''), '[^0-9]', '', 'g'), 10)
       or right(regexp_replace(coalesce(l.secondary_phone, ''), '[^0-9]', '', 'g'), 10)
         = right(regexp_replace(coalesce(cr.phone_number, ''), '[^0-9]', '', 'g'), 10)
     )
    where cr.lead_id is null
      and length(regexp_replace(coalesce(cr.phone_number, ''), '[^0-9]', '', 'g')) >= 10
    order by cr.id, l.created_at asc, l.id asc
  )
  update call_records cr
  set lead_id = matched.lead_id
  from matched
  where cr.id = matched.call_id
  returning cr.id, cr.user_id
`;

console.log("LINKED_ROWS", updated.length);

if (updated.length > 0) {
  const counts = new Map();
  for (const row of updated) {
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  }
  const userIds = [...counts.keys()];
  const users = await sql`
    select id, name from users where id in ${sql(userIds)}
  `;
  const named = users
    .map((u) => ({ name: u.name, n: counts.get(u.id) ?? 0 }))
    .sort((a, b) => b.n - a.n);
  console.log("BY_USER", named.slice(0, 20));
}

const hema = await sql`
  select
    count(*) filter (where lead_id is not null)::int as linked,
    count(*) filter (where lead_id is null)::int as unlinked
  from call_records
  where user_id = '98380b2c-c524-4285-b88b-365a6c9e3b00'::uuid
    and started_at >= now() - interval '14 days'
`;
console.log("HEMASHREE_14D_AFTER", hema[0]);

await sql.end();
