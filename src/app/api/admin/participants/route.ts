import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/domain/audit";
import { UserRole, InvitationStatus } from "@prisma/client";

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "ID do participante é obrigatório." }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        passports: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Participante não encontrado." }, { status: 404 });
    }

    if (targetUser.role === UserRole.ADMIN && targetUser.id === session.user.id) {
      return NextResponse.json({ error: "Não é possível auto-excluir a sua própria conta de administrador." }, { status: 400 });
    }

    const passportIds = targetUser.passports.map((p) => p.id);

    await prisma.$transaction(async (tx) => {
      // 1. Exclui carimbos dos passaportes do participante
      if (passportIds.length > 0) {
        await tx.stamp.deleteMany({
          where: { passportId: { in: passportIds } },
        });

        // 2. Exclui QR challenges
        await tx.qrChallenge.deleteMany({
          where: { passportId: { in: passportIds } },
        });
      }

      // 3. Se o participante utilizou um convite, libera o convite de volta para AVAILABLE
      const usedInv = await tx.invitation.findFirst({
        where: { usedById: userId },
      });

      if (usedInv) {
        await tx.invitation.update({
          where: { id: usedInv.id },
          data: {
            status: InvitationStatus.AVAILABLE,
            usedById: null,
            usedAt: null,
            claimedName: null,
            claimedEmail: null,
          },
        });
      }

      // 4. Remove qualquer PendingRegistration associado
      await tx.pendingRegistration.deleteMany({
        where: { normalizedEmail: targetUser.email },
      });

      // 5. Remove passaportes
      await tx.passport.deleteMany({
        where: { userId },
      });

      // 6. Remove sessões e contas Better Auth
      await tx.session.deleteMany({
        where: { userId },
      });
      await tx.account.deleteMany({
        where: { userId },
      });

      // 7. Remove o usuário
      await tx.user.delete({
        where: { id: userId },
      });

      // 8. Trilha de auditoria
      await createAuditLog({
        actorUserId: session.user.id,
        actorRole: "ADMIN",
        action: "PARTICIPANT_DELETED",
        entity: "User",
        entityId: userId,
        details: {
          name: targetUser.name,
          email: targetUser.email,
          passportIds,
          releasedInvitationId: usedInv?.id || null,
        },
        tx,
      });
    });

    return NextResponse.json({
      success: true,
      message: `Participante "${targetUser.name}" excluído com sucesso. A vaga de convite foi liberada.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao excluir participante.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
