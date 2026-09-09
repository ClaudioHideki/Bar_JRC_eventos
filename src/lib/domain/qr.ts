import { prisma } from "../db/prisma";
import { generateSecureToken, hashQrToken } from "../security/crypto";
import { QrChallengeStatus } from "@prisma/client";
import { createAuditLog } from "./audit";

export async function generateQrChallengeForUser({
  userId,
  ipAddress,
  userAgent,
}: {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const passport = await prisma.passport.findUnique({
    where: { userId },
  });

  if (!passport || passport.status !== "ACTIVE") {
    throw new Error("Passaporte não encontrado ou inativo.");
  }

  // Gera token criptográfico opaco de 256 bits (64 hex chars)
  const rawToken = generateSecureToken(32);
  const tokenHash = hashQrToken(rawToken);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos

  return await prisma.$transaction(async (tx) => {
    // Invalida/revoga qualquer QR challenge anterior ainda ativo para este passaporte
    await tx.qrChallenge.updateMany({
      where: {
        passportId: passport.id,
        status: QrChallengeStatus.ACTIVE,
      },
      data: {
        status: QrChallengeStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    const qr = await tx.qrChallenge.create({
      data: {
        passportId: passport.id,
        tokenHash,
        status: QrChallengeStatus.ACTIVE,
        expiresAt,
      },
    });

    await createAuditLog({
      actorUserId: userId,
      actorRole: "PARTICIPANT",
      action: "QR_CHALLENGE_GENERATED",
      entity: "QrChallenge",
      entityId: qr.id,
      ipAddress,
      userAgent,
      tx,
    });

    // Retorna o token original para o cliente renderizar o QR Code, sem dados pessoais
    return {
      token: rawToken,
      expiresAt,
    };
  });
}
