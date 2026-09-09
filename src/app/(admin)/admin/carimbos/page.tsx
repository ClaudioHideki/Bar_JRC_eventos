import { prisma } from "@/lib/db/prisma";
import { getOrCreateDefaultProgram } from "@/lib/domain/invitations";
import { AdminCarimbosClient } from "./AdminCarimbosClient";

export default async function AdminCarimbosPage() {
  const program = await getOrCreateDefaultProgram();

  const [stamps, events, passports] = await Promise.all([
    prisma.stamp.findMany({
      include: {
        passport: { include: { user: true } },
        event: true,
        attendant: true,
        cancelledBy: true,
      },
      orderBy: { stampedAt: "desc" },
    }),
    prisma.event.findMany({
      where: { programId: program.id, status: "ACTIVE" },
      orderBy: { orderIndex: "asc" },
      select: { id: true, name: true },
    }),
    prisma.passport.findMany({
      where: { programId: program.id, status: "ACTIVE" },
      include: { user: true },
      orderBy: { passportNumber: "asc" },
    }),
  ]);

  return (
    <AdminCarimbosClient
      initialStamps={stamps.map((s) => ({
        id: s.id,
        participantName: s.passport.user.name,
        participantEmail: s.passport.user.email,
        passportNumber: s.passport.passportNumber,
        eventName: s.event.name,
        attendantName: s.attendant.name,
        status: s.status,
        stampedAt: s.stampedAt.toISOString(),
        cancelledAt: s.cancelledAt ? s.cancelledAt.toISOString() : null,
        cancelledByName: s.cancelledBy?.name || null,
        cancellationReason: s.cancellationReason,
      }))}
      activeEvents={events}
      activePassports={passports.map((p) => ({
        id: p.id,
        passportNumber: p.passportNumber,
        participantName: p.user.name,
      }))}
    />
  );
}
