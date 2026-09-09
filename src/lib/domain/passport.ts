import { prisma } from "../db/prisma";

export async function getParticipantPassport(userId: string) {
  // IDOR Protection: consulta estritamente pelo userId da sessão validada
  return await prisma.passport.findUnique({
    where: { userId },
    include: {
      program: true,
      stamps: {
        where: { status: "CONFIRMED" },
        include: {
          event: true,
        },
        orderBy: { stampedAt: "desc" },
      },
    },
  });
}

export async function getProgramUpcomingEvents(programId: string) {
  const now = new Date();
  return await prisma.event.findMany({
    where: {
      programId,
      status: "ACTIVE",
      endDate: { gte: now },
    },
    orderBy: { startDate: "asc" },
  });
}

export async function getProgramEvents(programId: string) {
  return await prisma.event.findMany({
    where: {
      programId,
    },
    orderBy: { orderIndex: "asc" },
  });
}
