-- Migration: allow same email per role
-- Drop legacy unique(email) constraint/index if it exists
DO $
$
BEGIN
    IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
        AND indexname = 'users_email_key'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS "public"."users_email_key"';
END
IF;
END$$;

-- Also drop constraint form if it was created as a table constraint
ALTER TABLE "public"."users" DROP CONSTRAINT IF EXISTS "users_email_key";

-- Create composite unique on (email, role)
DO $$
BEGIN
    IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
        AND indexname = 'users_email_role_key'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX "users_email_role_key" ON "public"."users"("email", "role")';
END
IF;
END$$;
