import { prisma } from "../db/prisma";
import {
  encryptInvitationToken,
  generateSecureToken,
  hashInvitationToken,
  normalizeEmail,
} from "../security/crypto";
import { createAuditLog } from "./audit";
import { InvitationStatus, ProgramStatus } from "@prisma/client";

export async function getOrCreateDefaultProgram() {
  const defaultSlug = "passaporte-jrc-2026";

  let program = await prisma.program.findUnique({
    where: { slug: defaultSlug },
  });

  if (!program) {
    program = await prisma.program.create({
      data: {
        name: "Passaporte JRC 2026",
        slug: defaultSlug,
        capacity: 999999,
        status: ProgramStatus.ACTIVE,
      },
    });
  }

  return program;
}

export interface GeneratedInvitationResult {
  id: string;
  token: string;
  tokenHash: string;
  inviteLink: string;
  status: InvitationStatus;
}

/**
 * Gera um lote de convites garantindo no banco que a capacidade
 * do programa não seja excedida.
 */
export async function generateInvitationBatch({
  count,
  adminUserId,
  baseUrl,
}: {
  count: number;
  adminUserId?: string;
  baseUrl: string;
}): Promise<GeneratedInvitationResult[]> {
  const program = await getOrCreateDefaultProgram();

  return await prisma.$transaction(async (tx) => {
    const lockedProgram = await tx.$queryRaw<
      Array<{ id: string; capacity: number }>
    >`
      SELECT "id", "capacity"
      FROM "Program"
      WHERE "id" = ${program.id}
      FOR UPDATE
    `;

    if (!lockedProgram || lockedProgram.length === 0) {
      throw new Error("Programa não encontrado.");
    }

    const capacity = lockedProgram[0].capacity;

    const currentActiveInvites = await tx.invitation.count({
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

    if (currentActiveInvites + count > capacity) {
      throw new Error(
        `Limite de capacidade atingido. Capacidade total: ${capacity}. Ocupados/Disponíveis: ${currentActiveInvites}. Solicitados: ${count}.`
      );
    }

    const results: GeneratedInvitationResult[] = [];

    for (let i = 0; i < count; i++) {
      const rawToken = generateSecureToken(32);
      const tokenHash = hashInvitationToken(rawToken);
      const tokenEncrypted = encryptInvitationToken(rawToken);

      const inv = await tx.invitation.create({
        data: {
          programId: program.id,
          tokenHash,
          tokenEncrypted,
          status: InvitationStatus.AVAILABLE,
          createdById: adminUserId ?? null,
        },
      });

      results.push({
        id: inv.id,
        token: rawToken,
        tokenHash,
        inviteLink: `${baseUrl}/convite/${rawToken}`,
        status: inv.status,
      });
    }

    await createAuditLog({
      actorUserId: adminUserId,
      actorRole: "ADMIN",
      action: "INVITATION_BATCH_GENERATED",
      entity: "Invitation",
      details: {
        count,
        programId: program.id,
      },
      tx,
    });

    return results;
  });
}

export async function revokeInvitation({
  invitationId,
  adminUserId,
}: {
  invitationId: string;
  adminUserId: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const inv = await tx.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!inv) {
      throw new Error("Convite não encontrado.");
    }

    if (inv.status === InvitationStatus.USED) {
      throw new Error(
        "Não é possível revogar um convite que já foi utilizado."
      );
    }

    const updated = await tx.invitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    await createAuditLog({
      actorUserId: adminUserId,
      actorRole: "ADMIN",
      action: "INVITATION_REVOKED",
      entity: "Invitation",
      entityId: invitationId,
      tx,
    });

    return updated;
  });
}

export async function markInvitationAsSent({
  invitationId,
  recipientEmail,
  recipientName,
  recipientPhone,
  adminUserId,
}: {
  invitationId: string;
  recipientEmail?: string;
  recipientName?: string;
  recipientPhone?: string;
  adminUserId: string;
}) {
  const invitation = await prisma.invitation.findUnique({
    where: {
      id: invitationId,
    },
  });

  if (!invitation) {
    throw new Error("Convite não encontrado.");
  }

  if (invitation.status === InvitationStatus.USED) {
    throw new Error(
      "Não é possível editar os dados de um convite já utilizado."
    );
  }

  return await prisma.invitation.update({
    where: {
      id: invitationId,
    },
    data: {
      status: InvitationStatus.SENT,
      sentAt: invitation.sentAt ?? new Date(),
      claimedEmail: recipientEmail
        ? normalizeEmail(recipientEmail)
        : null,
      claimedName: recipientName?.trim() || null,
      phone: recipientPhone?.trim() || null,
    },
  });
}

export async function getInvitationByToken(rawToken: string) {
  const tokenHash = hashInvitationToken(rawToken);

  return await prisma.invitation.findUnique({
    where: {
      tokenHash,
    },
    include: {
      program: true,
    },
  });
}