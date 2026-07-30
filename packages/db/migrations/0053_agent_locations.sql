CREATE TABLE IF NOT EXISTS "agent_locations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "accuracy" DOUBLE PRECISION,
  "captured_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_agent_locations_user_captured"
  ON "agent_locations" ("user_id", "captured_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_agent_locations_captured"
  ON "agent_locations" ("captured_at" DESC);
