-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "themeImageUrl" TEXT,
ADD COLUMN     "themeSubtitle" TEXT,
ADD COLUMN     "themeTitle" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "lgpdConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lgpdConsentAt" TIMESTAMP(3),
ADD COLUMN     "lgpdConsentVersion" TEXT,
ADD COLUMN     "realEstateAgency" TEXT;
