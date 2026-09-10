import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { UserRole } from "@prisma/client";
import { createAuditLog } from "@/lib/domain/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Acesso restrito ao administrador." }, { status: 403 });
    }

    const program = await prisma.program.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    if (!program) {
      return NextResponse.json({ error: "Nenhum programa ativo." }, { status: 404 });
    }

    return NextResponse.json({
      id: program.id,
      name: program.name,
      themeImageUrl: program.themeImageUrl || "/brand/passaporte-template.jpg",
      themeTitle: program.themeTitle || "Passaporte JRC",
      themeSubtitle: program.themeSubtitle || "Setembro de 2027 é seu. Se você estiver lá até o fim.",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao buscar tema." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Acesso restrito ao administrador." }, { status: 403 });
    }

    const body = await req.json();
    const { themeImageUrl, themeTitle, themeSubtitle } = body;

    const program = await prisma.program.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    if (!program) {
      return NextResponse.json({ error: "Nenhum programa ativo." }, { status: 404 });
    }

    const updated = await prisma.program.update({
      where: { id: program.id },
      data: {
        themeImageUrl: themeImageUrl || "/brand/passaporte-template.jpg",
        themeTitle: themeTitle || undefined,
        themeSubtitle: themeSubtitle || undefined,
      },
    });

    await createAuditLog({
      actorUserId: session.user.id,
      actorRole: "ADMIN",
      action: "THEME_UPDATED",
      entity: "Program",
      entityId: program.id,
      details: {
        newThemeImageUrl: themeImageUrl,
        themeTitle,
        themeSubtitle,
      },
    });

    return NextResponse.json({
      success: true,
      program: updated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao atualizar tema." },
      { status: 500 }
    );
  }
}
