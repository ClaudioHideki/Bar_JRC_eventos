import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AttendantScannerClient } from "@/components/scanner/AttendantScannerClient";
import { UserRole, EventStatus } from "@prisma/client";

export default async function AttendantPage() {
  const session = await getServerSession();
  if (!session || !session.user) {
    redirect("/login");
  }

  if (session.user.role !== UserRole.ATTENDANT && session.user.role !== UserRole.ADMIN) {
    redirect("/passaporte");
  }

  const activeEvents = await prisma.event.findMany({
    where: { status: EventStatus.ACTIVE },
    orderBy: { orderIndex: "asc" },
    select: { id: true, name: true, location: true },
  });

  return (
    <AttendantScannerClient
      events={activeEvents}
      attendantName={session.user.name}
    />
  );
}
