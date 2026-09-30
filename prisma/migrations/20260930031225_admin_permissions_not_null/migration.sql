-- Reconcile AdminUser.permissions with the required Prisma scalar-list field.
UPDATE "AdminUser"
SET "permissions" = ARRAY[]::TEXT[]
WHERE "permissions" IS NULL;

ALTER TABLE "AdminUser"
  ALTER COLUMN "permissions" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "permissions" SET NOT NULL;
