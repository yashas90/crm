CREATE INDEX IF NOT EXISTS lead_activities_ad_external_lead_id_idx
  ON lead_activities ((metadata->>'externalLeadId'))
  WHERE (metadata->>'kind') = 'ad_lead';

CREATE INDEX IF NOT EXISTS leads_ad_external_lead_id_idx
  ON leads ((custom_fields->'adLead'->>'externalLeadId'))
  WHERE (custom_fields->'adLead'->>'externalLeadId') IS NOT NULL;
