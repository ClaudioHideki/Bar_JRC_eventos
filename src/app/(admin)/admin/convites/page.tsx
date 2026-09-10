import { prisma } from "@/lib/db/prisma";
import { getOrCreateDefaultProgram } from "@/lib/domain/invitations";
import { decryptInvitationToken } from "@/lib/security/crypto";
import { AdminConvitesClient } from "./AdminConvitesClient";

function recoverInviteLink(tokenEncrypted: string | null): string | null {
  if (!tokenEncrypted) {
    return null;
  }

  try {
    const rawToken = decryptInvitationToken(tokenEncrypted);

    const baseUrl = (
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");

    return `${baseUrl}/convite/${rawToken}`;
  } catch (error) {
    console.error("Erro ao recuperar link do convite:", error);
    return null;
  }
}

export default async function AdminConvitesPage() {
  const program = await getOrCreateDefaultProgram();

  const invitations = await prisma.invitation.findMany({
    where: {
      programId: program.id,
    },
    include: {
      usedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <AdminConvitesClient
      programCapacity={program.capacity}
      initialInvitations={invitations.map((i) => ({
        id: i.id,
        status: i.status,
        claimedName: i.claimedName,
        claimedEmail: i.claimedEmail,
        phone: i.phone,
        inviteLink: recoverInviteLink(i.tokenEncrypted),
        usedByName: i.usedBy?.name || null,
        usedByEmail: i.usedBy?.email || null,
        usedAt: i.usedAt ? i.usedAt.toISOString() : null,
        createdAt: i.createdAt.toISOString(),
      }))}
    />
  );
}