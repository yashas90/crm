-- Transaction closure forms, incentive profiles, and quarterly disbursements.
-- Existing tcf_consents (call/SMS/email consent) is unrelated and untouched.

CREATE TABLE IF NOT EXISTS transaction_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  tcf_code text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  segment text,
  channel text,
  currency text NOT NULL DEFAULT 'INR',
  cool_off_end_date date,
  product_name text,
  deal_closure_date date,
  client_access boolean NOT NULL DEFAULT false,
  initial_payment_verified boolean NOT NULL DEFAULT false,
  invoice_status text NOT NULL DEFAULT 'not_raised',
  net_revenue numeric(14, 2) NOT NULL DEFAULT 0,
  convertible boolean NOT NULL DEFAULT false,
  primary_applicant text,
  client_mobile text,
  form jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transaction_closures_status_check CHECK (
    status IN ('draft', 'pending_approval', 'approved', 'rejected')
  ),
  CONSTRAINT transaction_closures_invoice_status_check CHECK (
    invoice_status IN ('not_raised', 'raised', 'collected')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS transaction_closures_org_code_uidx
  ON transaction_closures (org_id, tcf_code);
CREATE INDEX IF NOT EXISTS transaction_closures_org_status_idx
  ON transaction_closures (org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS transaction_closures_created_by_idx
  ON transaction_closures (created_by);

CREATE TABLE IF NOT EXISTS transaction_closure_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tcf_id uuid NOT NULL REFERENCES transaction_closures(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  employee_name text NOT NULL,
  share_percent numeric(6, 2) NOT NULL,
  CONSTRAINT transaction_closure_shares_percent_check CHECK (
    share_percent >= 0 AND share_percent <= 100
  )
);

CREATE INDEX IF NOT EXISTS transaction_closure_shares_tcf_idx
  ON transaction_closure_shares (tcf_id);
CREATE INDEX IF NOT EXISTS transaction_closure_shares_user_idx
  ON transaction_closure_shares (user_id);

CREATE TABLE IF NOT EXISTS transaction_closure_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tcf_id uuid NOT NULL REFERENCES transaction_closures(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transaction_closure_events_tcf_idx
  ON transaction_closure_events (tcf_id, created_at DESC);

CREATE TABLE IF NOT EXISTS incentive_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id),
  band text,
  designation text,
  monthly_basic numeric(14, 2) NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incentive_profiles_band_check CHECK (
    band IS NULL OR band IN ('NE', 'N0', 'N1', 'N2', 'N3')
  )
);

CREATE TABLE IF NOT EXISTS incentive_disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quarter_key text NOT NULL,
  earned_amount numeric(14, 2) NOT NULL DEFAULT 0,
  cash_amount numeric(14, 2) NOT NULL DEFAULT 0,
  esop_amount numeric(14, 2) NOT NULL DEFAULT 0,
  disbursed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  disbursed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS incentive_disbursements_user_quarter_uidx
  ON incentive_disbursements (user_id, quarter_key);
