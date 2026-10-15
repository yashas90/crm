-- Calling-data request ceiling: 100 -> 200. Minimum stays 1.
-- Rows still sitting on the old cap move to 200. Lower custom limits stay.

ALTER TABLE agent_calling_limits DROP CONSTRAINT IF EXISTS agent_calling_limits_max_check;
ALTER TABLE agent_daily_limits DROP CONSTRAINT IF EXISTS agent_daily_limits_max_check;

ALTER TABLE agent_calling_limits ALTER COLUMN max_daily_limit SET DEFAULT 200;
ALTER TABLE agent_daily_limits ALTER COLUMN max_daily_limit SET DEFAULT 200;

UPDATE agent_calling_limits
SET max_daily_limit = 200, updated_at = now()
WHERE max_daily_limit = 100;

UPDATE agent_daily_limits
SET max_daily_limit = 200
WHERE max_daily_limit = 100
  AND date >= (timezone('Asia/Kolkata', now()))::date;

ALTER TABLE agent_calling_limits
  ADD CONSTRAINT agent_calling_limits_max_check
  CHECK (max_daily_limit >= 1 AND max_daily_limit <= 200);

ALTER TABLE agent_daily_limits
  ADD CONSTRAINT agent_daily_limits_max_check
  CHECK (max_daily_limit >= 1 AND max_daily_limit <= 200);
