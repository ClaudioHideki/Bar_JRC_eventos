import { prisma } from "../db/prisma";
import { hashQrToken } from "../security/crypto";
import { createAuditLog } from "./audit";
import { QrChallengeStatus, StampStatus } from "@prisma/client";

export async function validateQrToken(token: string) {
  const tokenHash = hashQrToken(token);
  const now = new Date();

  const challenge = await prisma.qrChallenge.findUnique({
    where: { tokenHash },
    include: {
      passport: {
        include: {
          user: true,
          program: true,
        },
      },
    },
  });

  if (!challenge) {
    throw new Error("QR Code não reconhecido.");
  }

  if (challenge.status === QrChallengeStatus.USED) {
    throw new Error("Este QR Code já foi utilizado.");
  }

  if (challenge.status === QrChallengeStatus.REVOKED) {
    throw new Error("Este QR Code foi substituído por um mais recente.");
  }

  if (challenge.expiresAt < now || challenge.status === QrChallengeStatus.EXPIRED) {
    throw new Error("Este QR Code expirou. O participante deve gerar um novo.");
  }

  return challenge;
}

export async function confirmStamp({
  qrToken,
  eventId,
  attendantUserId,
  ipAddress,
  userAgent,
}: {
  qrToken: string;
  eventId: string;
  attendantUserId: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const tokenHash = hashQrToken(qrToken);
  const now = new Date();

  // Transação atômica do carimbo
  return await prisma.$transaction(async (tx) => {
    // 1. Lock do QR Challenge
    const lockedQr = await tx.$queryRaw<Array<{ id: string; passportId: string; status: string; expiresAt: Date }>>`
      SELECT "id", "passportId", "status", "expiresAt" FROM "QrChallenge" WHERE "tokenHash" = ${tokenHash} FOR UPDATE
    `;

    if (!lockedQr || lockedQr.length === 0) {
      throw new Error("QR Code inválido.");
    }

    const qr = lockedQr[0];
    if (qr.status !== "ACTIVE" || qr.expiresAt < now) {
      throw new Error("QR Code não está ativo ou expirou.");
    }

    // 2. Valida Evento
    const event = await tx.event.findUnique({
      where: { id: eventId },
    });

    if (!event || event.status !== "ACTIVE") {
      throw new Error("Evento não encontrado ou não está ativo.");
    }

    // 3. Consome o QR imediatamente
    await tx.qrChallenge.update({
      where: { id: qr.id },
      data: {
        status: QrChallengeStatus.USED,
        usedAt: now,
      },
    });

    // 4. Criação do Carimbo
    try {
      const stamp = await tx.stamp.create({
        data: {
          passportId: qr.passportId,
          eventId,
          attendantId: attendantUserId,
          status: StampStatus.CONFIRMED,
          stampedAt: now,
        },
        include: {
          passport: {
            include: { user: true },
          },
          event: true,
        },
      });

      await createAuditLog({
        actorUserId: attendantUserId,
        actorRole: "ATTENDANT",
        action: "STAMP_CONFIRMED",
        entity: "Stamp",
        entityId: stamp.id,
        ipAddress,
        userAgent,
        details: {
          passportId: qr.passportId,
          eventId,
        },
        tx,
      });

      return stamp;
    } catch (err: unknown) {
      // Violação do índice parcial UNIQUE (Stamp_confirmed_passport_event_key)
      if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
        throw new Error("Este participante já possui carimbo confirmado neste evento.");
      }
      throw err;
    }
  });
}

export async function cancelStamp({
  stampId,
  adminUserId,
  reason,
  ipAddress,
  userAgent,
}: {
  stampId: string;
  adminUserId: string;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  if (!reason || reason.trim().length < 5) {
    throw new Error("Justificativa obrigatória (mínimo de 5 caracteres).");
  }

  return await prisma.$transaction(async (tx) => {
    const stamp = await tx.stamp.findUnique({
      where: { id: stampId },
    });

    if (!stamp) {
      throw new Error("Carimbo não encontrado.");
    }

    if (stamp.status === StampStatus.CANCELLED) {
      throw new Error("Este carimbo já foi cancelado.");
    }

    const updated = await tx.stamp.update({
      where: { id: stampId },
      data: {
        status: StampStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: adminUserId,
        cancellationReason: reason.trim(),
      },
    });

    await createAuditLog({
      actorUserId: adminUserId,
      actorRole: "ADMIN",
      action: "STAMP_CANCELLED",
      entity: "Stamp",
      entityId: stampId,
      ipAddress,
      userAgent,
      details: {
        reason: reason.trim(),
        passportId: stamp.passportId,
        eventId: stamp.eventId,
      },
      tx,
    });

    return updated;
  });
}

export async function adminManualStamp({
  passportId,
  eventId,
  adminUserId,
  justification,
  ipAddress,
  userAgent,
}: {
  passportId: string;
  eventId: string;
  adminUserId: string;
  justification: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  if (!justification || justification.trim().length < 5) {
    throw new Error("Justificativa obrigatória para carimbo manual de contingência.");
  }

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.stamp.findFirst({
      where: {
        passportId,
        eventId,
        status: StampStatus.CONFIRMED,
      },
    });

    if (existing) {
      throw new Error("Participante já possui presença confirmada neste evento.");
    }

    const stamp = await tx.stamp.create({
      data: {
        passportId,
        eventId,
        attendantId: adminUserId,
        status: StampStatus.CONFIRMED,
        stampedAt: new Date(),
        cancellationReason: `MANUAL_ADMIN: ${justification.trim()}`,
      },
      include: {
        passport: { include: { user: true } },
        event: true,
      },
    });

    await createAuditLog({
      actorUserId: adminUserId,
      actorRole: "ADMIN",
      action: "STAMP_MANUAL_CONTINGENCY",
      entity: "Stamp",
      entityId: stamp.id,
      ipAddress,
      userAgent,
      details: { justification: justification.trim() },
      tx,
    });

    return stamp;
  });
}
