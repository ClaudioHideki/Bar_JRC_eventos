import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const program = await prisma.program.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { loginLogoUrl: true },
  });
  return NextResponse.json({ loginLogoUrl: program?.loginLogoUrl || null }, {
    headers: { "Cache-Control": "no-store" },
  });
}
