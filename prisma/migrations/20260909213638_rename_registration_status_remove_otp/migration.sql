/*
  Warnings:

  - The values [PENDING_OTP,OTP_VERIFIED] on the enum `RegistrationStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RegistrationStatus_new" AS ENUM ('PENDING', 'VERIFIED', 'COMPLETED', 'EXPIRED', 'CANCELLED');
ALTER TABLE "PendingRegistration" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PendingRegistration" ALTER COLUMN "status" TYPE "RegistrationStatus_new" USING ("status"::text::"RegistrationStatus_new");
ALTER TYPE "RegistrationStatus" RENAME TO "RegistrationStatus_old";
ALTER TYPE "RegistrationStatus_new" RENAME TO "RegistrationStatus";
DROP TYPE "RegistrationStatus_old";
ALTER TABLE "PendingRegistration" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "PendingRegistration" ALTER COLUMN "status" SET DEFAULT 'PENDING';
