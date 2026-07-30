SELECT 'facebook_leads' AS t, COUNT(*)::int AS n FROM facebook_leads
UNION ALL SELECT 'facebook_leads_30d', COUNT(*)::int FROM facebook_leads WHERE ingested_at >= now() - interval '30 days'
UNION ALL SELECT 'facebook_webhooks', COUNT(*)::int FROM facebook_webhooks
UNION ALL SELECT 'ad_leads_7d', COUNT(*)::int FROM ad_leads WHERE created_at >= now() - interval '7 days';
SELECT status, COUNT(*)::int AS n FROM facebook_webhooks GROUP BY status ORDER BY n DESC;
SELECT name, is_active, is_selected, leadgen_subscribed, (access_token_encrypted IS NOT NULL) AS has_token FROM facebook_pages ORDER BY name;
SELECT status, LEFT(COALESCE(error_message,''), 100) AS err, created_at FROM facebook_webhooks ORDER BY created_at DESC LIMIT 10;
SELECT lead_source, COUNT(*)::int AS n FROM leads WHERE deleted_at IS NULL AND created_at >= now() - interval '2 days' GROUP BY 1 ORDER BY n DESC LIMIT 12;
