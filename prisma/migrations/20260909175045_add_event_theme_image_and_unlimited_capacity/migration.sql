-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "themeImageUrl" TEXT;

-- AlterTable
ALTER TABLE "Program" ALTER COLUMN "capacity" SET DEFAULT 999999;
