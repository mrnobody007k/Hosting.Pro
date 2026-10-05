-- Housing.pro keeps application data private and accesses it through its trusted server-side Prisma connection.
-- Explicitly deny direct Supabase Data API access for anon/authenticated on every current public RLS table.
DO $$
DECLARE
  tbl record;
BEGIN
  FOR tbl IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity = true
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = c.relname
      )
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      'deny_client_access', 'public', tbl.relname
    );
  END LOOP;
END
$$;

-- Enforce the same deny-by-default posture for future public tables.
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table', 'partitioned table')
  LOOP
    IF cmd.schema_name = 'public' THEN
      BEGIN
        EXECUTE format('ALTER TABLE IF EXISTS %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %s FROM anon, authenticated', cmd.object_identity);
        EXECUTE format(
          'CREATE POLICY %I ON %s AS PERMISSIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
          'deny_client_access', cmd.object_identity
        );
        RAISE LOG 'rls_auto_enable: RLS and client denial policy enabled on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to fully secure %', cmd.object_identity;
      END;
    ELSE
      RAISE LOG 'rls_auto_enable: skipped % (schema: %)', cmd.object_identity, cmd.schema_name;
    END IF;
  END LOOP;
END;
$function$;
