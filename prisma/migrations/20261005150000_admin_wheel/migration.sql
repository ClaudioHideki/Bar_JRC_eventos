CREATE TABLE "WheelPrize" (
  "id" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 0,
  "stockLimit" INTEGER NOT NULL DEFAULT 0,
  "awardedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WheelPrize_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WheelPrize_valid_counts" CHECK ("weight" >= 0 AND "stockLimit" >= 0 AND "awardedCount" >= 0 AND "awardedCount" <= "stockLimit")
);
CREATE UNIQUE INDEX "WheelPrize_programId_amountCents_key" ON "WheelPrize"("programId", "amountCents");
ALTER TABLE "WheelPrize" ADD CONSTRAINT "WheelPrize_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WheelSpin" (
  "id" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "prizeId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "adminUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WheelSpin_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WheelSpin_programId_createdAt_idx" ON "WheelSpin"("programId", "createdAt");
CREATE INDEX "WheelSpin_prizeId_idx" ON "WheelSpin"("prizeId");
ALTER TABLE "WheelSpin" ADD CONSTRAINT "WheelSpin_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WheelSpin" ADD CONSTRAINT "WheelSpin_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "WheelPrize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WheelSpin" ADD CONSTRAINT "WheelSpin_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
