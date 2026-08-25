-- Location pings used ON CONFLICT (user_id, event_id), but 0056 created a PARTIAL
-- unique index (WHERE event_id IS NOT NULL). PostgreSQL rejects that conflict target,
-- so every /api/locations/ping insert failed and the CRM showed zero pings.

UPDATE "agent_locations"
SET "event_id" = 'legacy_' || "id"::text
WHERE "event_id" IS NULL;

DROP INDEX IF EXISTS "idx_agent_locations_user_event";

CREATE UNIQUE INDEX IF NOT EXISTS "idx_agent_locations_user_event"
  ON "agent_locations" ("user_id", "event_id");
