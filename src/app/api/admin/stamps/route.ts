import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/domain/audit";
import { UserRole } from "@prisma/client";

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }

    const body = await req.json();
    const { stampId } = body;

    if (!stampId || typeof stampId !== "string") {
      return NextResponse.json({ error: "ID do carimbo é obrigatório." }, { status: 400 });
    }

    const stamp = await prisma.stamp.findUnique({
      where: { id: stampId },
      include: {
        passport: { include: { user: true } },
        event: true,
      },
    });

    if (!stamp) {
      return NextResponse.json({ error: "Carimbo não encontrado." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.stamp.delete({
        where: { id: stampId },
      });

      await createAuditLog({
        actorUserId: session.user.id,
        actorRole: "ADMIN",
        action: "STAMP_DELETED_PERMANENT",
        entity: "Stamp",
        entityId: stampId,
        details: {
          participantName: stamp.passport.user.name,
          eventName: stamp.event.name,
          passportNumber: stamp.passport.passportNumber,
        },
        tx,
      });
    });

    return NextResponse.json({
      success: true,
      message: `Carimbo do participante "${stamp.passport.user.name}" no evento "${stamp.event.name}" excluído com sucesso.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao excluir carimbo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
