ALTER TABLE "PendingRegistration" ADD COLUMN "phoneE164" TEXT;

CREATE TABLE "InvitationDeliveryToken" (
  "id" TEXT NOT NULL,
  "invitationId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvitationDeliveryToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InvitationDeliveryToken_tokenHash_key" ON "InvitationDeliveryToken"("tokenHash");
CREATE INDEX "InvitationDeliveryToken_invitationId_idx" ON "InvitationDeliveryToken"("invitationId");
ALTER TABLE "InvitationDeliveryToken" ADD CONSTRAINT "InvitationDeliveryToken_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
