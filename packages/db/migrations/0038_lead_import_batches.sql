-- Track bulk CSV lead uploads and link imported leads for outcome reporting.

CREATE TABLE IF NOT EXISTS lead_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  uploaded_by uuid NOT NULL REFERENCES users(id),
  file_name text,
  status text NOT NULL DEFAULT 'completed',
  total_count integer NOT NULL DEFAULT 0,
  unique_count integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  invalid_count integer NOT NULL DEFAULT 0,
  report_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT lead_import_batches_status_check
    CHECK (status IN ('initiated', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS lead_import_batches_org_id_created_at_idx
  ON lead_import_batches (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lead_import_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES lead_import_batches(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  row_number integer NOT NULL,
  outcome text NOT NULL,
  phone text,
  message text,
  CONSTRAINT lead_import_batch_items_outcome_check
    CHECK (outcome IN ('created', 'updated', 'skipped', 'failed')),
  UNIQUE (batch_id, row_number)
);

CREATE INDEX IF NOT EXISTS lead_import_batch_items_batch_id_idx ON lead_import_batch_items (batch_id);
CREATE INDEX IF NOT EXISTS lead_import_batch_items_lead_id_idx ON lead_import_batch_items (lead_id);
