import nodemailer from "nodemailer";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../db/prisma";
import { checkRateLimit } from "../rate-limit/postgres-rate-limit";
import { generateSecureToken, hashPasswordResetToken } from "../security/crypto";
import { normalizeBrazilianMobile, resolveStoredMobile } from "../security/phone";
import { createAuditLog } from "./audit";

export async function requestPasswordRecovery(phone: string, ipAddress: string, baseUrl: string) {
  const ipLimit = await checkRateLimit({ key: `password-recovery-ip:${ipAddress}`, limit: 5, windowSeconds: 3600 });
  if (!ipLimit.allowed) throw new Error("Muitas solicitações. Tente novamente mais tarde.");
  if (process.env.NODE_ENV === "production" && !(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)) {
    throw new Error("Peça ao administrador um link de recuperação pelo WhatsApp.");
  }
  let phoneE164: string;
  try { phoneE164 = normalizeBrazilianMobile(phone); } catch { return null; }
  const phoneLimit = await checkRateLimit({ key: `password-recovery-phone:${phoneE164}`, limit: 3, windowSeconds: 3600 });
  if (!phoneLimit.allowed) return null;
  let user = await prisma.user.findUnique({ where: { phoneE164 }, select: { id: true, email: true, role: true, status: true } });
  if (!user) {
    const legacyMatches = (await prisma.user.findMany({
      where: { phone: { not: null } },
      select: { id: true, email: true, role: true, status: true, phone: true },
    })).filter((candidate) => resolveStoredMobile(null, candidate.phone) === phoneE164);
    if (legacyMatches.length !== 1) return null;
    user = legacyMatches[0];
  }
  if (!user || user.role !== "PARTICIPANT" || user.status !== "ACTIVE") return null;

  const token = generateSecureToken(32);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const request = await prisma.passwordResetRequest.create({ data: { userId: user.id, tokenHash: hashPasswordResetToken(token), expiresAt } });
  const url = `${baseUrl.replace(/\/$/, "")}/recuperar-senha/${token}`;
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    try {
      const port = Number(process.env.SMTP_PORT || 587);
      const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
      await transport.sendMail({
        from: process.env.SMTP_FROM || "Passaporte JRC <no-reply@jrc.com.br>", to: user.email,
        subject: "Recupere seu acesso ao Passaporte JRC",
        text: `Use este link para definir uma nova senha. Ele expira em 15 minutos e só pode ser usado uma vez:\n${url}`,
      });
    } catch {
      await prisma.passwordResetRequest.delete({ where: { id: request.id } });
      return null;
    }
  }
  await prisma.passwordResetRequest.updateMany({ where: { userId: user.id, id: { not: request.id }, consumedAt: null }, data: { consumedAt: new Date() } });
  await createAuditLog({ action: "PASSWORD_RECOVERY_REQUESTED", entity: "User", entityId: user.id, ipAddress });
  return process.env.NODE_ENV === "production" ? null : url;
}

export async function prepareAdminPasswordRecovery(userId: string, baseUrl: string, adminUserId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, status: true, phone: true, phoneE164: true },
  });
  if (!user || user.role !== "PARTICIPANT" || user.status !== "ACTIVE") return null;
  const phoneE164 = resolveStoredMobile(user.phoneE164, user.phone);
  if (!phoneE164) return null;
  const token = generateSecureToken(32);
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetRequest.updateMany({
      where: { userId, consumedAt: null }, data: { consumedAt: new Date() },
    });
    await tx.passwordResetRequest.create({
      data: { userId, tokenHash: hashPasswordResetToken(token), expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
    });
    if (adminUserId) await createAuditLog({
      actorUserId: adminUserId, actorRole: "ADMIN", action: "PASSWORD_RECOVERY_LINK_PREPARED",
      entity: "User", entityId: userId, tx,
    });
  });
  return { name: user.name, phoneE164, url: `${baseUrl.replace(/\/$/, "")}/recuperar-senha/${token}` };
}

export async function completePasswordRecovery(token: string, password: string, ipAddress: string) {
  if (!/^[a-f0-9]{64}$/i.test(token)) throw new Error("Link inválido ou expirado.");
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new Error("A nova senha deve ter entre 8 e 128 caracteres.");
  }
  const tokenHash = hashPasswordResetToken(token);
  const passwordHash = await hashPassword(password);
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; userId: string; expiresAt: Date; consumedAt: Date | null }>>`
      SELECT "id", "userId", "expiresAt", "consumedAt" FROM "PasswordResetRequest" WHERE "tokenHash" = ${tokenHash} FOR UPDATE
    `;
    const reset = rows[0];
    if (!reset || reset.consumedAt || reset.expiresAt <= new Date()) throw new Error("Link inválido ou expirado.");
    const account = await tx.account.findFirst({ where: { userId: reset.userId, providerId: "credential" } });
    if (!account) throw new Error("Conta sem acesso por senha.");
    await tx.account.update({ where: { id: account.id }, data: { password: passwordHash } });
    await tx.passwordResetRequest.update({ where: { id: reset.id }, data: { consumedAt: new Date() } });
    await tx.session.deleteMany({ where: { userId: reset.userId } });
    await createAuditLog({ actorUserId: reset.userId, actorRole: "PARTICIPANT", action: "PASSWORD_RECOVERED", entity: "User", entityId: reset.userId, ipAddress, tx });
    return true;
  });
}
