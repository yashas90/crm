-- Monthly incentive approvals, quarterly appraisal approvals, and salary history.
-- Amounts are plain numbers (whole rupees). Display formatting is never stored.
-- Incentive status: pending_admin_approval → approved → disbursed, or rejected.
-- Appraisal status: pending_admin_approval → approved → salary_applied, or rejected.
-- Only an admin may move these statuses. The application enforces that.

CREATE TABLE IF NOT EXISTS incentive_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month_key text NOT NULL,
  quarter_key text NOT NULL,
  employee_name text NOT NULL,
  designation text,
  band text,
  monthly_salary numeric(14, 2) NOT NULL DEFAULT 0,
  eligibility_target numeric(14, 2) NOT NULL DEFAULT 0,
  nr_achieved numeric(14, 2) NOT NULL DEFAULT 0,
  achievement_percent numeric(8, 2) NOT NULL DEFAULT 0,
  incentive_till_target numeric(14, 2) NOT NULL DEFAULT 0,
  incentive_above_target numeric(14, 2) NOT NULL DEFAULT 0,
  gross_incentive numeric(14, 2) NOT NULL DEFAULT 0,
  cash_amount numeric(14, 2) NOT NULL DEFAULT 0,
  esop_amount numeric(14, 2) NOT NULL DEFAULT 0,
  n1_bonus numeric(14, 2) NOT NULL DEFAULT 0,
  total_payable numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_admin_approval',
  rejection_reason text,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  disbursed_at timestamptz,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT incentive_approvals_status_check CHECK (
    status IN ('pending_admin_approval', 'approved', 'rejected', 'disbursed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS incentive_approvals_user_month_uidx
  ON incentive_approvals (user_id, month_key);
CREATE INDEX IF NOT EXISTS incentive_approvals_org_status_idx
  ON incentive_approvals (org_id, status, month_key);
CREATE INDEX IF NOT EXISTS incentive_approvals_quarter_idx
  ON incentive_approvals (org_id, quarter_key);

CREATE TABLE IF NOT EXISTS appraisal_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quarter_key text NOT NULL,
  employee_name text NOT NULL,
  designation text,
  band text,
  required_sales numeric(8, 2),
  required_units numeric(8, 2),
  achieved_sales numeric(8, 2) NOT NULL DEFAULT 0,
  achieved_units numeric(8, 2) NOT NULL DEFAULT 0,
  eligible boolean NOT NULL DEFAULT false,
  current_salary numeric(14, 2) NOT NULL DEFAULT 0,
  hike_percent numeric(6, 4) NOT NULL DEFAULT 0,
  new_salary numeric(14, 2) NOT NULL DEFAULT 0,
  increment_amount numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_admin_approval',
  rejection_reason text,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  effective_from date,
  salary_applied_at timestamptz,
  deals jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appraisal_approvals_status_check CHECK (
    status IN ('pending_admin_approval', 'approved', 'rejected', 'salary_applied')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS appraisal_approvals_user_quarter_uidx
  ON appraisal_approvals (user_id, quarter_key);
CREATE INDEX IF NOT EXISTS appraisal_approvals_org_status_idx
  ON appraisal_approvals (org_id, status, quarter_key);

CREATE TABLE IF NOT EXISTS salary_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_salary numeric(14, 2) NOT NULL DEFAULT 0,
  new_salary numeric(14, 2) NOT NULL DEFAULT 0,
  increment_amount numeric(14, 2) NOT NULL DEFAULT 0,
  reason text NOT NULL,
  appraisal_id uuid REFERENCES appraisal_approvals(id) ON DELETE SET NULL,
  effective_from date,
  applied_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS salary_history_user_idx
  ON salary_history (user_id, applied_at DESC);
