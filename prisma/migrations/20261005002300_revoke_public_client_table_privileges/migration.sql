-- Housing.pro uses its trusted server-side Prisma connection for application data.
-- The Supabase anon/authenticated roles must not access private marketplace tables.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Prevent future tables created by the postgres role from inheriting client grants.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;

-- This function is attached to a PostgreSQL event trigger; it is not a client RPC.
-- Keep execution restricted to the database owner.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
