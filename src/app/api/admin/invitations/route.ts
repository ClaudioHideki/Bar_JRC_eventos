import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { generateInvitationBatch, revokeInvitation, markInvitationAsSent, getOrCreateDefaultProgram } from "@/lib/domain/invitations";
import { prisma } from "@/lib/db/prisma";
import { UserRole, InvitationStatus } from "@prisma/client";
import { generateSecureToken, hashInvitationToken, normalizeEmail } from "@/lib/security/crypto";
import nodemailer from "nodemailer";
import { createAuditLog } from "@/lib/domain/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }

    const invitations = await prisma.invitation.findMany({
      include: {
        usedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invitations, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Erro ao listar convites." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }

    const body = await req.json();
    const origin = req.nextUrl.origin;
    const baseUrl = process.env.APP_URL || origin || "http://localhost:3000";

    // Caso 1: Convite nominal para cliente específico
    if (body.recipientName || body.recipientEmail) {
      const recipientName = body.recipientName?.trim() || "";
      const recipientEmail = body.recipientEmail ? normalizeEmail(body.recipientEmail) : null;

      const program = await getOrCreateDefaultProgram();
      const rawToken = generateSecureToken(32);
      const tokenHash = hashInvitationToken(rawToken);

      const invitation = await prisma.$transaction(async (tx) => {
        // Bloqueio pessimista do programa para conferência estrita do teto de capacidade (AGENTS.md 2.1)
        const lockedProgram = await tx.$queryRaw<Array<{ id: string; capacity: number }>>`
          SELECT "id", "capacity" FROM "Program" WHERE "id" = ${program.id} FOR UPDATE
        `;

        if (!lockedProgram || lockedProgram.length === 0) {
          throw new Error("Programa não encontrado.");
        }

        const capacity = lockedProgram[0].capacity;

        // Contabiliza convites utilizáveis e utilizados
        const activeCount = await tx.invitation.count({
          where: {
            programId: program.id,
            status: { in: [InvitationStatus.AVAILABLE, InvitationStatus.SENT, InvitationStatus.USED] },
          },
        });

        if (activeCount >= capacity) {
          throw new Error(
            `Limite de capacidade atingido (${capacity} convites). Revogue ou exclua convites existentes para liberar vagas.`
          );
        }

        return await tx.invitation.create({
          data: {
            programId: program.id,
            tokenHash,
            status: InvitationStatus.SENT,
            claimedName: recipientName || null,
            claimedEmail: recipientEmail || null,
            createdById: session.user.id,
            sentAt: new Date(),
          },
        });
      });

      const inviteLink = `${baseUrl}/convite/${rawToken}`;

      // Se houver e-mail e SMTP configurado, tenta disparar por e-mail
      let emailSent = false;
      if (recipientEmail && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
        try {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || "587", 10),
            secure: process.env.SMTP_PORT === "465",
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            },
          });

          await transporter.sendMail({
            from: process.env.SMTP_FROM || "Passaporte JRC <no-reply@jrc.com.br>",
            to: recipientEmail,
            subject: "Seu Convite Exclusivo — Passaporte Bar JRC 40 Anos",
            html: `
              <div style="font-family: sans-serif; background-color: #071725; color: #f7f8fa; padding: 28px; border-radius: 12px; max-width: 550px;">
                <h2 style="color: #cdaa63; margin-top: 0;">Você foi convidado para o Bar JRC!</h2>
                <p>Olá ${recipientName || "Parceiro JRC"},</p>
                <p>Você recebeu um convite oficial para ativar seu <strong>Passaporte Bar JRC</strong>. Participe dos nossos encontros mensais, complete os 12 carimbos e garanta o direito de escolher a temática do evento de Dezembro!</p>
                <div style="margin: 24px 0;">
                  <a href="${inviteLink}" style="background: #19b8c4; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                    Ativar Meu Passaporte Agora
                  </a>
                </div>
                <p style="color: #9eacba; font-size: 12px;">Ou acesse o link: <br/><a href="${inviteLink}" style="color: #cdaa63;">${inviteLink}</a></p>
              </div>
            `,
          });
          emailSent = true;
        } catch (mailErr) {
          console.error("Erro ao enviar e-mail de convite:", mailErr);
        }
      }

      return NextResponse.json({
        id: invitation.id,
        inviteLink,
        token: rawToken,
        claimedName: recipientName,
        claimedEmail: recipientEmail,
        emailSent,
      }, { status: 201 });
    }

    // Caso 2: Geração de lote em massa
    const count = parseInt(body.count || "1", 10);
    const batch = await generateInvitationBatch({
      count,
      adminUserId: session.user.id,
      baseUrl,
    });

    return NextResponse.json(batch, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao gerar convites.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }

    const body = await req.json();

    // Caso: Limpar todos os convites não utilizados (AVAILABLE ou REVOKED)
    if (body.clearUnused) {
      const deleted = await prisma.invitation.deleteMany({
        where: {
          status: { in: [InvitationStatus.AVAILABLE, InvitationStatus.REVOKED] },
        },
      });
      return NextResponse.json({ success: true, count: deleted.count, message: `${deleted.count} convite(s) não utilizados foram removidos.` }, { status: 200 });
    }

    const { invitationId, permanentDelete } = body;

    if (!invitationId) {
      return NextResponse.json({ error: "ID do convite é obrigatório." }, { status: 400 });
    }

    // Exclusão definitiva do convite
    if (permanentDelete) {
      const inv = await prisma.invitation.findUnique({ where: { id: invitationId } });
      if (!inv) {
        return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
      }

      await prisma.$transaction(async (tx) => {
        // 1. Remove qualquer PendingRegistration vinculado ao convite
        await tx.pendingRegistration.deleteMany({
          where: { invitationId },
        });

        // 2. Se o convite estava vinculado a um usuário (USED), desvincula
        if (inv.usedById) {
          await tx.invitation.update({
            where: { id: invitationId },
            data: { usedById: null },
          });
        }

        // 3. Exclui o convite definitivamente
        await tx.invitation.delete({
          where: { id: invitationId },
        });

        // 4. Registra auditoria da exclusão
        await createAuditLog({
          actorUserId: session.user.id,
          actorRole: "ADMIN",
          action: "INVITATION_DELETED_PERMANENT",
          entity: "Invitation",
          entityId: invitationId,
          details: { wasUsed: inv.status === InvitationStatus.USED, previousStatus: inv.status },
          tx,
        });
      });

      return NextResponse.json({ success: true, message: "Convite excluído do banco de dados com sucesso." }, { status: 200 });
    }

    // Caso padrão: revogar convite
    const revoked = await revokeInvitation({
      invitationId,
      adminUserId: session.user.id,
    });

    return NextResponse.json(revoked, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao processar convite.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }

    const body = await req.json();
    const { invitationId, recipientEmail, recipientName } = body;

    if (!invitationId) {
      return NextResponse.json({ error: "ID do convite é obrigatório." }, { status: 400 });
    }

    const updated = await markInvitationAsSent({
      invitationId,
      recipientEmail,
      recipientName,
      adminUserId: session.user.id,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao marcar convite como enviado.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
