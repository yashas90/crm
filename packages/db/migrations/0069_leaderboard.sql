ALTER TABLE users
  ADD COLUMN IF NOT EXISTS show_leaderboard_avatar boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS leaderboard_rank_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  scope_key text NOT NULL,
  rank integer NOT NULL,
  snapshot_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_rank_snapshots_uidx UNIQUE (user_id, period_key, scope_key, snapshot_date)
);

CREATE INDEX IF NOT EXISTS leaderboard_rank_snapshots_lookup_idx
  ON leaderboard_rank_snapshots (period_key, scope_key, snapshot_date);

CREATE TABLE IF NOT EXISTS agent_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  period_month integer,
  period_year integer,
  period_quarter integer
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_badges_agent_type_period_uidx
  ON agent_badges (agent_id, badge_type, period_month, period_year, period_quarter)
  NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS agent_badges_agent_idx
  ON agent_badges (agent_id, earned_at);

CREATE TABLE IF NOT EXISTS leaderboard_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  kind text NOT NULL,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_announcements_kind_check CHECK (kind IN ('announcement', 'challenge'))
);

CREATE INDEX IF NOT EXISTS leaderboard_announcements_org_idx
  ON leaderboard_announcements (org_id, kind, active);
