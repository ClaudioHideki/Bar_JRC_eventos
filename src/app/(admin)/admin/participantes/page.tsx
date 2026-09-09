import { prisma } from "@/lib/db/prisma";
import { getOrCreateDefaultProgram } from "@/lib/domain/invitations";

import { AdminParticipantesClient } from "./AdminParticipantesClient";

export default async function AdminParticipantesPage() {
  const program = await getOrCreateDefaultProgram();

  const passports = await prisma.passport.findMany({
    where: { programId: program.id },
    include: {
      user: true,
      _count: {
        select: {
          stamps: { where: { status: "CONFIRMED" } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminParticipantesClient
      initialParticipants={passports.map((p) => ({
        id: p.user.id,
        name: p.user.name,
        email: p.user.email,
        image: p.user.image,
        realEstateAgency: p.user.realEstateAgency,
        passportId: p.id,
        passportNumber: p.passportNumber,
        stampsCount: p._count.stamps,
        lgpdConsent: p.user.lgpdConsent,
        lgpdConsentVersion: p.user.lgpdConsentVersion,
        createdAt: p.createdAt.toISOString(),
      }))}
    />
  );
}
