import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import {
  generateInvitationBatch,
  revokeInvitation,
  markInvitationAsSent,
  getOrCreateDefaultProgram,
} from "@/lib/domain/invitations";
import { prisma } from "@/lib/db/prisma";
import { UserRole, InvitationStatus } from "@prisma/client";
import {
  decryptInvitationToken,
  encryptInvitationToken,
  generateSecureToken,
  hashInvitationToken,
  normalizeEmail,
} from "@/lib/security/crypto";
import nodemailer from "nodemailer";
import { createAuditLog } from "@/lib/domain/audit";

function getBaseUrl(req: NextRequest): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    req.nextUrl.origin ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function recoverInviteLink(
  tokenEncrypted: string | null,
  baseUrl: string
): string | null {
  if (!tokenEncrypted) {
    return null;
  }

  try {
    const rawToken = decryptInvitationToken(tokenEncrypted);
    return `${baseUrl}/convite/${rawToken}`;
  } catch (error) {
    console.error("Erro ao recuperar link de convite:", error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);

    if (
      !session ||
      !session.user ||
      session.user.role !== UserRole.ADMIN
    ) {
      return NextResponse.json(
        { error: "Acesso restrito a administradores." },
        { status: 403 }
      );
    }

    const baseUrl = getBaseUrl(req);

    const invitations = await prisma.invitation.findMany({
      select: {
        id: true,
        status: true,
        claimedName: true,
        claimedEmail: true,
        phone: true,
        tokenEncrypted: true,
        usedAt: true,
        createdAt: true,
        usedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const safeInvitations = invitations.map((invitation) => ({
      id: invitation.id,
      status: invitation.status,
      claimedName: invitation.claimedName,
      claimedEmail: invitation.claimedEmail,
      phone: invitation.phone,
      usedByName: invitation.usedBy?.name || null,
      usedByEmail: invitation.usedBy?.email || null,
      usedAt: invitation.usedAt
        ? invitation.usedAt.toISOString()
        : null,
      createdAt: invitation.createdAt.toISOString(),
      inviteLink: recoverInviteLink(
        invitation.tokenEncrypted,
        baseUrl
      ),
    }));

    return NextResponse.json(safeInvitations, {
      status: 200,
    });
  } catch (error) {
    console.error("Erro ao listar convites:", error);

    return NextResponse.json(
      { error: "Erro ao listar convites." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);

    if (
      !session ||
      !session.user ||
      session.user.role !== UserRole.ADMIN
    ) {
      return NextResponse.json(
        { error: "Acesso restrito a administradores." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const baseUrl = getBaseUrl(req);

    // -----------------------------------------------------------------------
    // Caso 1: convite nominal para cliente específico
    // -----------------------------------------------------------------------
    if (
      body.recipientName ||
      body.recipientEmail ||
      body.phone
    ) {
      const recipientName =
        typeof body.recipientName === "string"
          ? body.recipientName.trim()
          : "";

      const recipientEmail =
        typeof body.recipientEmail === "string" &&
        body.recipientEmail.trim()
          ? normalizeEmail(body.recipientEmail)
          : null;

      const recipientPhone =
        typeof body.phone === "string"
          ? body.phone.trim()
          : "";

      const program = await getOrCreateDefaultProgram();

      const rawToken = generateSecureToken(32);
      const tokenHash = hashInvitationToken(rawToken);
      const tokenEncrypted =
        encryptInvitationToken(rawToken);

      const invitation = await prisma.$transaction(
        async (tx) => {
          // Bloqueio pessimista para evitar estouro de capacidade
          const lockedProgram = await tx.$queryRaw<
            Array<{
              id: string;
              capacity: number;
            }>
          >`
            SELECT "id", "capacity"
            FROM "Program"
            WHERE "id" = ${program.id}
            FOR UPDATE
          `;

          if (
            !lockedProgram ||
            lockedProgram.length === 0
          ) {
            throw new Error(
              "Programa não encontrado."
            );
          }

          const capacity =
            lockedProgram[0].capacity;

          const activeCount =
            await tx.invitation.count({
              where: {
                programId: program.id,
                status: {
                  in: [
                    InvitationStatus.AVAILABLE,
                    InvitationStatus.SENT,
                    InvitationStatus.USED,
                  ],
                },
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
              tokenEncrypted,
              status: InvitationStatus.SENT,
              claimedName:
                recipientName || null,
              claimedEmail:
                recipientEmail || null,
              phone:
                recipientPhone || null,
              createdById:
                session.user.id,
              sentAt: new Date(),
            },
          });
        },
        {
          maxWait: 15000,
          timeout: 30000,
        }
      );

      const inviteLink =
        `${baseUrl}/convite/${rawToken}`;

      // ---------------------------------------------------------------------
      // Envio opcional por e-mail
      // ---------------------------------------------------------------------
      let emailSent = false;

      if (
        recipientEmail &&
        process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASSWORD
      ) {
        try {
          const transporter =
            nodemailer.createTransport({
              host: process.env.SMTP_HOST,
              port: parseInt(
                process.env.SMTP_PORT || "587",
                10
              ),
              secure:
                process.env.SMTP_PORT === "465",
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
              },
            });

          await transporter.sendMail({
            from:
              process.env.SMTP_FROM ||
              "Passaporte JRC <no-reply@jrc.com.br>",
            to: recipientEmail,
            subject:
              "Seu Convite Oficial — Passaporte Bar JRC",
            html: `
              <div style="font-family: sans-serif; background-color: #071725; color: #f7f8fa; padding: 28px; border-radius: 12px; max-width: 550px;">
                <h2 style="color: #cdaa63; margin-top: 0;">
                  Você recebeu seu Passaporte JRC!
                </h2>

                <p>
                  Olá ${recipientName || "Parceiro JRC"},
                </p>

                <p>
                  Você recebeu o passaporte oficial.
                  Participe das campanhas comerciais e garanta
                  seus vistos no nosso passaporte.
                </p>

                <div style="margin: 24px 0;">
                  <a
                    href="${inviteLink}"
                    style="background: #19b8c4; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;"
                  >
                    Ativar Meu Passaporte
                  </a>
                </div>

                <p style="color: #9eacba; font-size: 12px;">
                  Ou acesse o link:
                  <br />
                  <a
                    href="${inviteLink}"
                    style="color: #cdaa63;"
                  >
                    ${inviteLink}
                  </a>
                </p>
              </div>
            `,
          });

          emailSent = true;
        } catch (mailError) {
          console.error(
            "Erro ao enviar e-mail de convite:",
            mailError
          );
        }
      }

      // Nunca devolvemos tokenHash ou tokenEncrypted ao navegador
      return NextResponse.json(
        {
          id: invitation.id,
          status: invitation.status,
          inviteLink,
          claimedName:
            invitation.claimedName,
          claimedEmail:
            invitation.claimedEmail,
          phone: invitation.phone,
          emailSent,
        },
        {
          status: 201,
        }
      );
    }

    // -----------------------------------------------------------------------
    // Caso 2: geração de lote
    // -----------------------------------------------------------------------
    const count = parseInt(
      String(body.count || "1"),
      10
    );

    if (
      !Number.isFinite(count) ||
      count < 1 ||
      count > 500
    ) {
      return NextResponse.json(
        {
          error:
            "Quantidade de convites inválida.",
        },
        {
          status: 400,
        }
      );
    }

    const batch =
      await generateInvitationBatch({
        count,
        adminUserId: session.user.id,
        baseUrl,
      });

    // Não expõe tokenHash nem o token separado.
    // A interface precisa apenas do link pronto.
    const safeBatch = batch.map(
      (invitation) => ({
        id: invitation.id,
        status: invitation.status,
        inviteLink:
          invitation.inviteLink,
      })
    );

    return NextResponse.json(
      safeBatch,
      {
        status: 201,
      }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Erro ao gerar convites.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 400,
      }
    );
  }
}

export async function DELETE(
  req: NextRequest
) {
  try {
    const session = await getServerSession(req);

    if (
      !session ||
      !session.user ||
      session.user.role !== UserRole.ADMIN
    ) {
      return NextResponse.json(
        { error: "Acesso restrito a administradores." },
        { status: 403 }
      );
    }

    const body = await req.json();

    // -----------------------------------------------------------------------
    // Limpar convites não utilizados
    // -----------------------------------------------------------------------
    if (body.clearUnused) {
      const deleted =
        await prisma.invitation.deleteMany({
          where: {
            status: {
              in: [
                InvitationStatus.AVAILABLE,
                InvitationStatus.REVOKED,
              ],
            },
          },
        });

      return NextResponse.json(
        {
          success: true,
          count: deleted.count,
          message:
            `${deleted.count} convite(s) não utilizados foram removidos.`,
        },
        {
          status: 200,
        }
      );
    }

    const {
      invitationId,
      permanentDelete,
    } = body;

    if (!invitationId) {
      return NextResponse.json(
        {
          error:
            "ID do convite é obrigatório.",
        },
        {
          status: 400,
        }
      );
    }

    // -----------------------------------------------------------------------
    // Exclusão definitiva
    // -----------------------------------------------------------------------
    if (permanentDelete) {
      const inv =
        await prisma.invitation.findUnique({
          where: {
            id: invitationId,
          },
        });

      if (!inv) {
        return NextResponse.json(
          {
            error:
              "Convite não encontrado.",
          },
          {
            status: 404,
          }
        );
      }

      await prisma.$transaction(
        async (tx) => {
          // Remove cadastros pendentes ligados ao convite
          await tx.pendingRegistration.deleteMany(
            {
              where: {
                invitationId,
              },
            }
          );

          // Caso esteja ligado a um usuário, desvincula antes da exclusão
          if (inv.usedById) {
            await tx.invitation.update({
              where: {
                id: invitationId,
              },
              data: {
                usedById: null,
              },
            });
          }

          await tx.invitation.delete({
            where: {
              id: invitationId,
            },
          });

          await createAuditLog({
            actorUserId:
              session.user.id,
            actorRole: "ADMIN",
            action:
              "INVITATION_DELETED_PERMANENT",
            entity: "Invitation",
            entityId: invitationId,
            details: {
              wasUsed:
                inv.status ===
                InvitationStatus.USED,
              previousStatus:
                inv.status,
            },
            tx,
          });
        }
      );

      return NextResponse.json(
        {
          success: true,
          message:
            "Convite excluído do banco de dados com sucesso.",
        },
        {
          status: 200,
        }
      );
    }

    // -----------------------------------------------------------------------
    // Revogação
    // -----------------------------------------------------------------------
    const revoked =
      await revokeInvitation({
        invitationId,
        adminUserId:
          session.user.id,
      });

    return NextResponse.json(
      {
        id: revoked.id,
        status: revoked.status,
      },
      {
        status: 200,
      }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Erro ao processar convite.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 400,
      }
    );
  }
}

export async function PATCH(
  req: NextRequest
) {
  try {
    const session = await getServerSession(req);

    if (
      !session ||
      !session.user ||
      session.user.role !== UserRole.ADMIN
    ) {
      return NextResponse.json(
        { error: "Acesso restrito a administradores." },
        { status: 403 }
      );
    }

    const body = await req.json();

    const {
      invitationId,
      recipientEmail,
      recipientName,
      recipientPhone,
      phone,
    } = body;

    if (!invitationId) {
      return NextResponse.json(
        {
          error:
            "ID do convite é obrigatório.",
        },
        {
          status: 400,
        }
      );
    }

    const normalizedPhone =
      typeof recipientPhone === "string"
        ? recipientPhone
        : typeof phone === "string"
          ? phone
          : undefined;

    const updated =
      await markInvitationAsSent({
        invitationId,
        recipientEmail:
          typeof recipientEmail === "string"
            ? recipientEmail
            : undefined,
        recipientName:
          typeof recipientName === "string"
            ? recipientName
            : undefined,
        recipientPhone:
          normalizedPhone,
        adminUserId:
          session.user.id,
      });

    const baseUrl = getBaseUrl(req);

    const inviteLink =
      recoverInviteLink(
        updated.tokenEncrypted,
        baseUrl
      );

    return NextResponse.json(
      {
        id: updated.id,
        status: updated.status,
        claimedName:
          updated.claimedName,
        claimedEmail:
          updated.claimedEmail,
        phone: updated.phone,
        usedAt:
          updated.usedAt?.toISOString() ||
          null,
        createdAt:
          updated.createdAt.toISOString(),
        inviteLink,
      },
      {
        status: 200,
      }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Erro ao editar convite.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 400,
      }
    );
  }
}