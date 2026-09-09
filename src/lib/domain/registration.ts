import { prisma } from "../db/prisma";
import {
  hashInvitationToken,
  normalizeEmail,
  generateSecureToken,
} from "../security/crypto";
import { sendEmailOtp } from "../email/sender";
import { createAuditLog } from "./audit";
import { checkRateLimit } from "../rate-limit/postgres-rate-limit";
import {
  InvitationStatus,
  RegistrationStatus,
  UserRole,
  UserStatus,
  PassportStatus,
} from "@prisma/client";

export async function requestInvitationOtp({
  token,
  name,
  email,
  ipAddress,
}: {
  token: string;
  name: string;
  email: string;
  ipAddress: string;
}) {
  const normalizedEmail = normalizeEmail(email);
  const trimmedName = name.trim();

  if (!trimmedName || !normalizedEmail) {
    throw new Error("Nome completo e e-mail são obrigatórios.");
  }

  // 1. Rate Limiting por IP e por E-mail
  const ipLimit = await checkRateLimit({
    key: `otp-req-ip:${ipAddress}`,
    limit: 5,
    windowSeconds: 300,
  });
  if (!ipLimit.allowed) {
    throw new Error("Muitas solicitações deste dispositivo. Aguarde alguns minutos.");
  }

  const emailLimit = await checkRateLimit({
    key: `otp-req-email:${normalizedEmail}`,
    limit: 3,
    windowSeconds: 300,
  });
  if (!emailLimit.allowed) {
    throw new Error("Muitas solicitações para este e-mail. Aguarde alguns minutos.");
  }

  // 2. Valida Convite
  const tokenHash = hashInvitationToken(token);
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    include: { program: true },
  });

  if (!invitation) {
    throw new Error("Convite inválido ou inexistente.");
  }

  if (invitation.status !== InvitationStatus.AVAILABLE && invitation.status !== InvitationStatus.SENT) {
    throw new Error("Este convite já foi utilizado ou não está mais ativo.");
  }

  // 3. Verifica se este e-mail já possui passaporte ativo
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { passports: true },
  });

  if (existingUser && existingUser.passports.length > 0) {
    throw new Error("Este e-mail já possui um passaporte ativo no programa.");
  }

  // 4. Cria ou atualiza PendingRegistration
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min
  const registration = await prisma.pendingRegistration.upsert({
    where: { id: `reg_${invitation.id}` }, // ou busca por invitationId
    create: {
      id: `reg_${invitation.id}`,
      programId: invitation.programId,
      invitationId: invitation.id,
      normalizedEmail,
      name: trimmedName,
      status: RegistrationStatus.PENDING_OTP,
      expiresAt,
    },
    update: {
      normalizedEmail,
      name: trimmedName,
      status: RegistrationStatus.PENDING_OTP,
      expiresAt,
    },
  });

  // 5. Gera OTP de 6 dígitos
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Armazena verificação no banco para conferência segura
  const codeHash = hashInvitationToken(otpCode); // Hashed OTP
  await prisma.verification.create({
    data: {
      id: `otp_${registration.id}_${Date.now()}`,
      identifier: `invitation:${normalizedEmail}`,
      value: codeHash,
      expiresAt,
    },
  });

  // Envia OTP
  await sendEmailOtp({
    email: normalizedEmail,
    otp: otpCode,
    type: "INVITATION_ACTIVATION",
  });

  return {
    success: true,
    message: "Código de ativação enviado com sucesso para o seu e-mail.",
    devOtp: process.env.NODE_ENV !== "production" ? otpCode : undefined,
  };
}

export async function confirmInvitationOtpAndCreatePassport({
  token,
  email,
  otp,
  ipAddress,
  userAgent,
}: {
  token: string;
  email: string;
  otp: string;
  ipAddress: string;
  userAgent?: string;
}) {
  const normalizedEmail = normalizeEmail(email);

  // 1. Rate Limiting de tentativas
  const attemptLimit = await checkRateLimit({
    key: `otp-verify:${normalizedEmail}`,
    limit: 5,
    windowSeconds: 300,
  });
  if (!attemptLimit.allowed) {
    throw new Error("Limite de tentativas excedido. Solicite um novo código.");
  }

  // 2. Valida OTP hashed
  const codeHash = hashInvitationToken(otp.trim());
  const now = new Date();

  const verification = await prisma.verification.findFirst({
    where: {
      identifier: `invitation:${normalizedEmail}`,
      value: codeHash,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!verification) {
    throw new Error("Código inválido ou expirado.");
  }

  // Consome a verificação de uso único
  await prisma.verification.delete({
    where: { id: verification.id },
  });

  const tokenHash = hashInvitationToken(token);

  // 3. Transação atômica serializada de ativação do participante
  return await prisma.$transaction(async (tx) => {
    // Lock do convite
    const lockedInv = await tx.$queryRaw<Array<{ id: string; status: string; programId: string }>>`
      SELECT "id", "status", "programId" FROM "Invitation" WHERE "tokenHash" = ${tokenHash} FOR UPDATE
    `;

    if (!lockedInv || lockedInv.length === 0) {
      throw new Error("Convite não encontrado.");
    }

    if (lockedInv[0].status !== InvitationStatus.AVAILABLE && lockedInv[0].status !== InvitationStatus.SENT) {
      throw new Error("Convite já utilizado ou inativo.");
    }

    const invitationId = lockedInv[0].id;
    const programId = lockedInv[0].programId;

    const registration = await tx.pendingRegistration.findFirst({
      where: {
        invitationId,
        normalizedEmail,
      },
    });

    if (!registration) {
      throw new Error("Registro pendente não encontrado para este convite.");
    }

    // Cria ou atualiza usuário para ACTIVE
    const user = await tx.user.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        name: registration.name,
        role: UserRole.PARTICIPANT,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
      update: {
        name: registration.name,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
    });

    // Gera número amigável exclusivo do passaporte: JRC-2026-XXXX
    const randomSuffix = generateSecureToken(2).toUpperCase();
    const passportNumber = `JRC-2026-${randomSuffix}`;

    const passport = await tx.passport.create({
      data: {
        programId,
        userId: user.id,
        passportNumber,
        status: PassportStatus.ACTIVE,
      },
    });

    // Atualiza o convite como USED
    await tx.invitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.USED,
        usedById: user.id,
        usedAt: new Date(),
        claimedEmail: normalizedEmail,
        claimedName: registration.name,
      },
    });

    // Atualiza pendingRegistration para COMPLETED
    await tx.pendingRegistration.update({
      where: { id: registration.id },
      data: {
        status: RegistrationStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    await createAuditLog({
      actorUserId: user.id,
      actorRole: "PARTICIPANT",
      action: "INVITATION_ACTIVATED",
      entity: "Passport",
      entityId: passport.id,
      ipAddress,
      userAgent,
      details: {
        passportNumber,
        programId,
        invitationId,
      },
      tx,
    });

    return {
      success: true,
      user,
      passport,
    };
  });
}
