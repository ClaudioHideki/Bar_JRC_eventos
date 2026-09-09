import { prisma } from "@/lib/db/prisma";
import { getOrCreateDefaultProgram } from "@/lib/domain/invitations";
import { AdminEventosClient } from "./AdminEventosClient";

export default async function AdminEventosPage() {
  const program = await getOrCreateDefaultProgram();

  const events = await prisma.event.findMany({
    where: { programId: program.id },
    include: {
      _count: {
        select: {
          stamps: { where: { status: "CONFIRMED" } },
        },
      },
    },
    orderBy: { orderIndex: "asc" },
  });

  return (
    <AdminEventosClient
      initialEvents={events.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        location: e.location,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        status: e.status,
        orderIndex: e.orderIndex,
        confirmedCount: e._count.stamps,
      }))}
    />
  );
}
