-- Tables added after 0063_user_hard_delete still use ON DELETE NO ACTION.
-- Deleting a user then fails even after their leads are reassigned.
-- Repeat the hard-delete policy for every user foreign key that is still restrictive.
-- Primary keys and per-user queues disappear with the account. Other links are cleared.

DO $$
DECLARE
  r record;
  del_action text;
BEGIN
  FOR r IN
    SELECT
      con.conname,
      con.conrelid::regclass AS table_name,
      c.relname AS rel_name,
      att.attname AS column_name,
      att.attnotnull AS is_not_null,
      con.confdeltype AS del_type,
      EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = con.conrelid
          AND i.indisprimary
          AND att.attnum = ANY (i.indkey)
      ) AS is_primary
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = con.conkey[1]
     AND NOT att.attisdropped
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.users'::regclass
      AND array_length(con.conkey, 1) = 1
  LOOP
    IF r.del_type IN ('c', 'n') THEN
      CONTINUE;
    END IF;

    IF r.is_primary
      OR r.rel_name ~ 'notification'
      OR r.rel_name ~ 'agent_target'
      OR r.rel_name IN (
        'agent_calling_limits',
        'agent_daily_limits',
        'agent_data_requests',
        'agent_calling_data',
        'contact_call_logs'
      )
    THEN
      del_action := 'CASCADE';
    ELSE
      del_action := 'SET NULL';
    END IF;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.table_name, r.conname);

    IF del_action = 'SET NULL' AND r.is_not_null AND NOT r.is_primary THEN
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

-- Call logs point at calling-data rows. Cascading the user must not fail on that link.
DO $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.contact_call_logs') IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT con.conname, con.conrelid::regclass AS table_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND c.relname = 'contact_call_logs'
      AND att.attname = 'record_id'
      AND con.confdeltype NOT IN ('c', 'n')
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.table_name, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (record_id) REFERENCES public.agent_calling_data(record_id) ON DELETE SET NULL',
      r.table_name,
      r.conname
    );
  END LOOP;
END $$;
