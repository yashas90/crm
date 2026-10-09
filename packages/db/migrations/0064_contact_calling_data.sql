-- Calling-data pool (bucket 1) plus links from qualified contacts into existing leads (bucket 2).

CREATE TABLE IF NOT EXISTS upload_batches (
  batch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  batch_name text NOT NULL,
  uploaded_by uuid REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  file_name text NOT NULL,
  total_records integer NOT NULL DEFAULT 0,
  processed_records integer NOT NULL DEFAULT 0,
  valid_records integer NOT NULL DEFAULT 0,
  duplicate_records integer NOT NULL DEFAULT 0,
  invalid_records integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing',
  priority integer NOT NULL DEFAULT 0,
  error_message text,
  CONSTRAINT upload_batches_status_check CHECK (status IN ('processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS upload_batches_org_uploaded_idx
  ON upload_batches (org_id, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS contact_pool (
  contact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  upload_batch_id uuid REFERENCES upload_batches(batch_id),
  name text NOT NULL,
  phone text NOT NULL,
  phone_hash text NOT NULL,
  alternate_phone text,
  email text,
  city text,
  locality text,
  budget numeric(14, 2),
  budget_label text,
  property_type text,
  bedrooms text,
  source text,
  notes text,
  status text NOT NULL DEFAULT 'unassigned',
  assigned_to_agent_id uuid REFERENCES users(id),
  assigned_at timestamptz,
  called_at timestamptz,
  call_outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by_admin_id uuid REFERENCES users(id),
  CONSTRAINT contact_pool_status_check CHECK (
    status IN ('unassigned', 'assigned', 'called', 'interested', 'not_interested', 'callback', 'dnc', 'invalid')
  ),
  CONSTRAINT contact_pool_property_type_check CHECK (
    property_type IS NULL OR property_type IN ('apartment', 'villa', 'plot')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS contact_pool_org_phone_uidx ON contact_pool (org_id, phone);
CREATE INDEX IF NOT EXISTS contact_pool_org_status_created_idx ON contact_pool (org_id, status, created_at);
CREATE INDEX IF NOT EXISTS contact_pool_batch_idx ON contact_pool (upload_batch_id);
CREATE INDEX IF NOT EXISTS contact_pool_assigned_agent_idx ON contact_pool (assigned_to_agent_id);
CREATE INDEX IF NOT EXISTS contact_pool_unassigned_fifo_idx
  ON contact_pool (org_id, created_at)
  WHERE status = 'unassigned';

CREATE TABLE IF NOT EXISTS upload_invalid_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES upload_batches(batch_id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL
);

CREATE INDEX IF NOT EXISTS upload_invalid_rows_batch_idx ON upload_invalid_rows (batch_id);

CREATE TABLE IF NOT EXISTS agent_data_requests (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  agent_id uuid NOT NULL REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  contacts_requested integer NOT NULL,
  contacts_assigned integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  denial_reason text,
  filters_applied jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT agent_data_requests_status_check CHECK (
    status IN ('pending', 'fulfilled', 'partial', 'denied')
  )
);

CREATE INDEX IF NOT EXISTS agent_data_requests_agent_requested_idx
  ON agent_data_requests (agent_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS agent_calling_limits (
  agent_id uuid PRIMARY KEY REFERENCES users(id),
  org_id uuid NOT NULL REFERENCES organizations(id),
  max_daily_limit integer NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_calling_limits_max_check CHECK (max_daily_limit >= 1 AND max_daily_limit <= 100)
);

CREATE TABLE IF NOT EXISTS agent_daily_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  agent_id uuid NOT NULL REFERENCES users(id),
  date date NOT NULL,
  contacts_requested_today integer NOT NULL DEFAULT 0,
  contacts_called_today integer NOT NULL DEFAULT 0,
  max_daily_limit integer NOT NULL DEFAULT 100,
  last_request_at timestamptz,
  CONSTRAINT agent_daily_limits_max_check CHECK (max_daily_limit >= 1 AND max_daily_limit <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_daily_limits_agent_date_uidx
  ON agent_daily_limits (agent_id, date);
CREATE INDEX IF NOT EXISTS agent_daily_limits_date_idx ON agent_daily_limits (date);

CREATE TABLE IF NOT EXISTS agent_calling_data (
  record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  contact_pool_id uuid NOT NULL REFERENCES contact_pool(contact_id),
  agent_id uuid NOT NULL REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  phone text NOT NULL,
  city text,
  budget text,
  property_type text,
  bedrooms text,
  status text NOT NULL DEFAULT 'pending',
  call_attempts integer NOT NULL DEFAULT 0,
  last_called_at timestamptz,
  callback_scheduled_at timestamptz,
  callback_notified_at timestamptz,
  call_notes text,
  deleted_at timestamptz,
  deleted_reason text,
  CONSTRAINT agent_calling_data_status_check CHECK (
    status IN ('pending', 'callback', 'retry', 'interested', 'not_interested', 'invalid', 'dnc')
  ),
  CONSTRAINT agent_calling_data_attempts_check CHECK (call_attempts >= 0 AND call_attempts <= 3)
);

CREATE INDEX IF NOT EXISTS agent_calling_data_agent_active_idx
  ON agent_calling_data (agent_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS agent_calling_data_callback_idx
  ON agent_calling_data (callback_scheduled_at)
  WHERE deleted_at IS NULL AND status = 'callback';
CREATE UNIQUE INDEX IF NOT EXISTS agent_calling_data_active_contact_uidx
  ON agent_calling_data (contact_pool_id)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS agent_calling_data_active_phone_uidx
  ON agent_calling_data (org_id, phone)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS contact_call_logs (
  log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  contact_id uuid NOT NULL REFERENCES contact_pool(contact_id),
  agent_id uuid NOT NULL REFERENCES users(id),
  record_id uuid REFERENCES agent_calling_data(record_id),
  called_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer NOT NULL DEFAULT 0,
  outcome text NOT NULL,
  callback_scheduled_at timestamptz,
  notes text,
  lead_created boolean NOT NULL DEFAULT false,
  lead_id uuid REFERENCES leads(id),
  CONSTRAINT contact_call_logs_outcome_check CHECK (
    outcome IN ('interested', 'not_interested', 'callback', 'no_answer', 'busy', 'invalid', 'dnc')
  )
);

CREATE INDEX IF NOT EXISTS contact_call_logs_agent_called_idx
  ON contact_call_logs (agent_id, called_at DESC);
CREATE INDEX IF NOT EXISTS contact_call_logs_contact_idx ON contact_call_logs (contact_id);

CREATE TABLE IF NOT EXISTS dnc_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  phone text NOT NULL,
  phone_hash text NOT NULL,
  reason text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dnc_phones_org_phone_uidx ON dnc_phones (org_id, phone);

CREATE TABLE IF NOT EXISTS contact_pool_settings (
  org_id uuid PRIMARY KEY REFERENCES organizations(id),
  requests_paused boolean NOT NULL DEFAULT false,
  paused_at timestamptz,
  paused_by uuid REFERENCES users(id),
  low_pool_threshold integer NOT NULL DEFAULT 500,
  cost_per_contact numeric(14, 2),
  last_low_pool_alert_at timestamptz,
  last_limit_reset_date date,
  last_morning_reminder_date date,
  last_evening_summary_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_contact_pool_id uuid REFERENCES contact_pool(contact_id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_agent_id uuid REFERENCES users(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualified_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pipeline_stage text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_pipeline_stage_check'
  ) THEN
    ALTER TABLE leads ADD CONSTRAINT leads_pipeline_stage_check CHECK (
      pipeline_stage IS NULL OR pipeline_stage IN (
        'new', 'contacted', 'site_visit_scheduled', 'site_visit_done',
        'negotiation', 'closed_won', 'closed_lost'
      )
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS leads_source_contact_pool_id_idx ON leads (source_contact_pool_id);
CREATE INDEX IF NOT EXISTS leads_pipeline_stage_idx ON leads (pipeline_stage);
CREATE INDEX IF NOT EXISTS leads_source_calling_idx ON leads (org_id, assigned_to)
  WHERE lead_source = 'calling_data' AND deleted_at IS NULL;

-- A phone cannot sit in active calling data and an open lead at the same time.
CREATE OR REPLACE FUNCTION prevent_calling_data_lead_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NULL AND EXISTS (
    SELECT 1
    FROM leads l
    WHERE l.org_id = NEW.org_id
      AND l.deleted_at IS NULL
      AND right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 10)
        = right(regexp_replace(NEW.phone, '\D', '', 'g'), 10)
      AND length(right(regexp_replace(NEW.phone, '\D', '', 'g'), 10)) = 10
  ) THEN
    RAISE EXCEPTION 'phone already a lead' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agent_calling_data_no_lead_overlap ON agent_calling_data;
CREATE TRIGGER agent_calling_data_no_lead_overlap
  BEFORE INSERT OR UPDATE ON agent_calling_data
  FOR EACH ROW
  EXECUTE FUNCTION prevent_calling_data_lead_overlap();

CREATE OR REPLACE FUNCTION prevent_lead_calling_data_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NULL AND NEW.phone IS NOT NULL AND EXISTS (
    SELECT 1
    FROM agent_calling_data ac
    WHERE ac.org_id = NEW.org_id
      AND ac.deleted_at IS NULL
      AND right(regexp_replace(ac.phone, '\D', '', 'g'), 10)
        = right(regexp_replace(NEW.phone, '\D', '', 'g'), 10)
      AND length(right(regexp_replace(NEW.phone, '\D', '', 'g'), 10)) = 10
  ) THEN
    RAISE EXCEPTION 'phone still in calling data' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_no_calling_data_overlap ON leads;
CREATE TRIGGER leads_no_calling_data_overlap
  BEFORE INSERT OR UPDATE OF phone, deleted_at ON leads
  FOR EACH ROW
  EXECUTE FUNCTION prevent_lead_calling_data_overlap();
