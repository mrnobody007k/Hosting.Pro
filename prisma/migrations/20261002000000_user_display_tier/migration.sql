CREATE TYPE "DisplayTier" AS ENUM ('GOLD', 'DIAMOND', 'MERCHANT');

ALTER TABLE "User" ADD COLUMN "displayTier" "DisplayTier";
