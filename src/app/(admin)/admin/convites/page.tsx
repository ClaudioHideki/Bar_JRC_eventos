import { prisma } from "@/lib/db/prisma";
import { getOrCreateDefaultProgram } from "@/lib/domain/invitations";
import { AdminConvitesClient } from "./AdminConvitesClient";

export default async function AdminConvitesPage() {
  const program = await getOrCreateDefaultProgram();

  const invitations = await prisma.invitation.findMany({
    where: { programId: program.id },
    include: {
      usedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminConvitesClient
      programCapacity={program.capacity}
      initialInvitations={invitations.map((i) => ({
        id: i.id,
        status: i.status,
        claimedName: i.claimedName,
        claimedEmail: i.claimedEmail,
        usedByName: i.usedBy?.name || null,
        usedByEmail: i.usedBy?.email || null,
        usedAt: i.usedAt ? i.usedAt.toISOString() : null,
        createdAt: i.createdAt.toISOString(),
      }))}
    />
  );
}
