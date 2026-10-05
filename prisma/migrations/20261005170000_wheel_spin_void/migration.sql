ALTER TABLE "WheelSpin" ADD COLUMN "voidedAt" TIMESTAMP(3);
ALTER TABLE "WheelSpin" ADD COLUMN "voidedById" TEXT;
CREATE INDEX "WheelSpin_programId_voidedAt_idx" ON "WheelSpin"("programId", "voidedAt");
