import { prisma } from "@/lib/db/prisma";
import { AdminTemasClient } from "./AdminTemasClient";

export default async function TemasPage() {
  const program = await prisma.program.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  const initialTheme = {
    themeImageUrl: program?.themeImageUrl || "/brand/passaporte-template.jpg",
    themeTitle: program?.themeTitle || "Passaporte JRC",
    themeSubtitle: program?.themeSubtitle || "Setembro de 2027 é seu. Se você estiver lá até o fim.",
  };

  const events = program
    ? await prisma.event.findMany({
        where: { programId: program.id },
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          name: true,
          orderIndex: true,
          themeImageUrl: true,
        },
      })
    : [];

  return <AdminTemasClient initialTheme={initialTheme} initialEvents={events} />;
}
