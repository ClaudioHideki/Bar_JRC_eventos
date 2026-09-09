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
    themeSubtitle: program?.themeSubtitle || "Dezembro é seu. Se você estiver lá até o fim.",
  };

  return <AdminTemasClient initialTheme={initialTheme} />;
}
