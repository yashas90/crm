import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const leads = await sql`select count(*)::int as n from facebook_leads`;
  const leads30 =
    await sql`select count(*)::int as n from facebook_leads where ingested_at >= now() - interval '30 days'`;
  const webhooks =
    await sql`select status, count(*)::int as n from facebook_webhooks group by status order by n desc`;
  const recentWh =
    await sql`select status, error_message, meta_page_id, created_at from facebook_webhooks order by created_at desc limit 15`;
  const pages =
    await sql`select page_id, name, is_active, is_selected, leadgen_subscribed, (access_token_encrypted is not null) as has_token from facebook_pages order by name`;
  const forms =
    await sql`select count(*)::int as n, count(*) filter (where is_active)::int as active, count(*) filter (where is_selected)::int as selected, count(*) filter (where project_id is not null)::int as mapped from facebook_forms`;
  const metaSrc =
    await sql`select lead_source, count(*)::int as n from leads where deleted_at is null and created_at >= now() - interval '2 days' group by 1 order by n desc limit 15`;
  const adLeads =
    await sql`select count(*)::int as n from ad_leads where created_at >= now() - interval '7 days'`;
  const tables =
    await sql`select table_name from information_schema.tables where table_schema='public' and table_name like 'facebook%' order by 1`;
  const connTable = tables.some((t) => t.table_name === "facebook_connections")
    ? await sql`select * from facebook_connections limit 1`
    : [];

  console.log(
    JSON.stringify(
      { leads, leads30, webhooks, recentWh, pages, forms, metaSrc, adLeads, tables, connTable },
      null,
      2,
    ),
  );
} finally {
  await sql.end({ timeout: 5 });
}
