/*
  Warnings:

  - You are about to drop the column `autoApproveDisabled` on the `Setting` table. All the data in the column will be lost.
  - You are about to drop the column `sellProtectionEnabled` on the `Setting` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Setting" DROP COLUMN "autoApproveDisabled",
DROP COLUMN "sellProtectionEnabled",
ADD COLUMN     "sellProtection" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "swapAutoApprove" BOOLEAN NOT NULL DEFAULT false;
