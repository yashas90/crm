-- Lead lists used to sort every row with a phone window function, twice per page.
-- phone_key + is_primary_phone let the default list scan one partial index.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_key text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_primary_phone boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION leads_phone_key(phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN length(right(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10)) >= 10
    THEN right(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10)
    ELSE NULL
  END
$$;

UPDATE leads
SET phone_key = leads_phone_key(phone)
WHERE phone_key IS DISTINCT FROM leads_phone_key(phone);

UPDATE leads AS l
SET is_primary_phone = src.keep
FROM (
  SELECT
    id,
    CASE
      WHEN phone_key IS NULL THEN true
      ELSE row_number() OVER (
        PARTITION BY phone_key, (deleted_at IS NULL)
        ORDER BY created_at ASC, id ASC
      ) = 1
    END AS keep
  FROM leads
) AS src
WHERE l.id = src.id
  AND l.is_primary_phone IS DISTINCT FROM src.keep;

CREATE OR REPLACE FUNCTION leads_refresh_phone_primary(p_key text, p_active boolean)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  keeper uuid;
BEGIN
  IF p_key IS NULL OR length(p_key) < 10 THEN
    RETURN;
  END IF;

  SELECT id INTO keeper
  FROM leads
  WHERE phone_key = p_key
    AND (deleted_at IS NULL) = p_active
  ORDER BY created_at ASC, id ASC
  LIMIT 1;

  UPDATE leads
  SET is_primary_phone = (id = keeper)
  WHERE phone_key = p_key
    AND (deleted_at IS NULL) = p_active
    AND is_primary_phone IS DISTINCT FROM (id = keeper);
END;
$$;

CREATE OR REPLACE FUNCTION leads_phone_primary_before()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.phone_key := leads_phone_key(NEW.phone);
  IF NEW.phone_key IS NULL THEN
    NEW.is_primary_phone := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION leads_phone_primary_after()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM leads_refresh_phone_primary(OLD.phone_key, OLD.deleted_at IS NULL);
    RETURN OLD;
  END IF;

  PERFORM leads_refresh_phone_primary(NEW.phone_key, NEW.deleted_at IS NULL);
  IF TG_OP = 'UPDATE' AND (
    OLD.phone_key IS DISTINCT FROM NEW.phone_key
    OR (OLD.deleted_at IS NULL) IS DISTINCT FROM (NEW.deleted_at IS NULL)
  ) THEN
    PERFORM leads_refresh_phone_primary(OLD.phone_key, OLD.deleted_at IS NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_phone_primary_before_trg ON leads;
CREATE TRIGGER leads_phone_primary_before_trg
  BEFORE INSERT OR UPDATE OF phone, deleted_at ON leads
  FOR EACH ROW
  EXECUTE FUNCTION leads_phone_primary_before();

DROP TRIGGER IF EXISTS leads_phone_primary_after_trg ON leads;
CREATE TRIGGER leads_phone_primary_after_trg
  AFTER INSERT OR UPDATE OF phone, deleted_at OR DELETE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION leads_phone_primary_after();

CREATE INDEX IF NOT EXISTS leads_phone_key_active_idx
  ON leads (phone_key, created_at, id)
  WHERE phone_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS leads_primary_active_created_idx
  ON leads (created_at DESC)
  WHERE deleted_at IS NULL AND is_primary_phone;

CREATE INDEX IF NOT EXISTS leads_primary_assigned_created_idx
  ON leads (assigned_to, created_at DESC)
  WHERE deleted_at IS NULL AND is_primary_phone;

CREATE INDEX IF NOT EXISTS leads_primary_status_created_idx
  ON leads (lead_status, created_at DESC)
  WHERE deleted_at IS NULL AND is_primary_phone;

CREATE INDEX IF NOT EXISTS projects_active_created_idx
  ON projects (created_at DESC)
  WHERE deleted_at IS NULL;
