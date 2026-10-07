-- Deleting a user must not leave their name attached to leads, history, or logs.
-- The API moves open leads (and related work) first. Remaining foreign keys either
-- disappear with the user or drop the pointer so joins no longer resolve a name.

DO $$
DECLARE
  r record;
  del_action text;
BEGIN
  FOR r IN
    SELECT
      con.conname,
      con.conrelid::regclass AS table_name,
      att.attname AS column_name,
      att.attnotnull AS is_not_null,
      con.confdeltype AS del_type
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.users'::regclass
      AND array_length(con.conkey, 1) = 1
  LOOP
    -- Already cascade or set null.
    IF r.del_type IN ('c', 'n') THEN
      CONTINUE;
    END IF;

    IF r.table_name::text ~ 'notification' OR r.table_name::text ~ 'agent_target' THEN
      del_action := 'CASCADE';
    ELSE
      del_action := 'SET NULL';
    END IF;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.table_name, r.conname);

    IF del_action = 'SET NULL' AND r.is_not_null THEN
      EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP NOT NULL', r.table_name, r.column_name);
    END IF;

    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users(id) ON DELETE %s',
      r.table_name,
      r.conname,
      r.column_name,
      del_action
    );
  END LOOP;
END $$;
