import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const byDay = await sql`
    select date_trunc('day', created_at at time zone 'Asia/Kolkata')::date as day_ist,
           count(*)::int as n
    from leads
    where deleted_at is null
      and lead_source = 'Meta Ads'
      and created_at >= now() - interval '7 days'
    group by 1
    order by 1 desc
  `;

  const meta = await sql`
    select id, first_name, last_name, lead_source, phone, created_at, tags, custom_fields
    from leads
    where deleted_at is null
      and lead_source = 'Meta Ads'
      and created_at >= now() - interval '3 days'
    order by created_at desc
    limit 25
  `;

  const ad =
    await sql`select count(*)::int as n, min(created_at) as first, max(created_at) as last from ad_leads`;
  const fb = await sql`select count(*)::int as n from facebook_leads`;
  const wh = await sql`select count(*)::int as n from facebook_webhooks`;
  const importItems = await sql`
    select libi.outcome, count(*)::int as n
    from lead_import_batch_items libi
    join leads l on l.id = libi.lead_id
    where l.lead_source = 'Meta Ads'
      and l.created_at >= now() - interval '3 days'
    group by 1
  `;

  const samples = meta.map((r) => ({
    name: `${r.first_name} ${r.last_name}`,
    created: r.created_at,
    tags: r.tags,
    cfKeys: r.custom_fields ? Object.keys(r.custom_fields) : [],
    adLead: r.custom_fields?.lastAdLead ?? r.custom_fields?.adLead ?? null,
    phoneTail: r.phone ? String(r.phone).slice(-4) : null,
  }));

  console.log(JSON.stringify({ byDay, ad, fb, wh, importItems, samples }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
