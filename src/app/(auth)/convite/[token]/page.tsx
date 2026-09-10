import { getInvitationByToken } from "@/lib/domain/invitations";
import { ConviteClient } from "./ConviteClient";
import { InvitationStatus } from "@prisma/client";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!token || typeof token !== "string") {
    return (
      <ConviteClient
        token=""
        tokenStatus="INVALID"
      />
    );
  }

  const invitation =
    await getInvitationByToken(token);

  if (!invitation) {
    return (
      <ConviteClient
        token={token}
        tokenStatus="INVALID"
      />
    );
  }

  if (
    invitation.expiresAt &&
    invitation.expiresAt.getTime() <= Date.now()
  ) {
    return (
      <ConviteClient
        token={token}
        tokenStatus="EXPIRED"
      />
    );
  }

  if (
    invitation.status ===
    InvitationStatus.USED
  ) {
    return (
      <ConviteClient
        token={token}
        tokenStatus="USED"
      />
    );
  }

  if (
    invitation.status ===
    InvitationStatus.REVOKED
  ) {
    return (
      <ConviteClient
        token={token}
        tokenStatus="INVALID"
      />
    );
  }

  return (
    <ConviteClient
      token={token}
      initialName={
        invitation.claimedName || ""
      }
      initialEmail={
        invitation.claimedEmail || ""
      }
      tokenStatus="VALID"
    />
  );
}