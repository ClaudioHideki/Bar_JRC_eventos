ALTER TABLE "User" ADD COLUMN "phoneE164" TEXT;
ALTER TABLE "Invitation" ADD COLUMN "recipientPhoneE164" TEXT;
ALTER TABLE "Program" ADD COLUMN "loginLogoUrl" TEXT;

CREATE UNIQUE INDEX "User_phoneE164_key" ON "User"("phoneE164");
CREATE INDEX "Invitation_recipientPhoneE164_status_idx" ON "Invitation"("recipientPhoneE164", "status");
CREATE UNIQUE INDEX "Invitation_active_phone_key" ON "Invitation"("recipientPhoneE164") WHERE "recipientPhoneE164" IS NOT NULL AND "status" IN ('AVAILABLE', 'SENT', 'USED');

CREATE TABLE "EventReview" (
  "id" TEXT NOT NULL,
  "passportId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "feedback" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventReview_rating_range" CHECK ("rating" BETWEEN 0 AND 10)
);
CREATE UNIQUE INDEX "EventReview_passportId_eventId_key" ON "EventReview"("passportId", "eventId");
CREATE INDEX "EventReview_eventId_submittedAt_idx" ON "EventReview"("eventId", "submittedAt");
ALTER TABLE "EventReview" ADD CONSTRAINT "EventReview_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "Passport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventReview" ADD CONSTRAINT "EventReview_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PasswordResetRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordResetRequest_tokenHash_key" ON "PasswordResetRequest"("tokenHash");
CREATE INDEX "PasswordResetRequest_userId_expiresAt_idx" ON "PasswordResetRequest"("userId", "expiresAt");
ALTER TABLE "PasswordResetRequest" ADD CONSTRAINT "PasswordResetRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
