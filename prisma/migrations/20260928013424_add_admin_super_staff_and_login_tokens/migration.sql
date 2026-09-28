/*
  Warnings:

  - Added the required column `updatedAt` to the `AdminUser` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AdminType" AS ENUM ('SUPER_ADMIN', 'STAFF_ADMIN');

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "adminType" "AdminType" NOT NULL DEFAULT 'STAFF_ADMIN',
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PlatformSetting" ADD COLUMN     "customerLoginAccessToken" TEXT,
ADD COLUMN     "managerLoginAccessToken" TEXT;
