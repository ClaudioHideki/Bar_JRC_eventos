import { prisma } from "../db/prisma";
import { normalizeEmail } from "../security/crypto";
import { normalizeBrazilianMobile, resolveStoredMobile } from "../security/phone";
import { buildCampaignMessage } from "./campaign-message";
import { createAuditLog } from "./audit";

export async function findParticipantContact(phone: string) {
  const normalized = normalizeBrazilianMobile(phone);
  const direct = await prisma.user.findMany({ where: { role: "PARTICIPANT", status: "ACTIVE", phoneE164: normalized }, select: { id: true, name: true, email: true, phone: true, phoneE164: true, image: true } });
  const legacy = await prisma.user.findMany({ where: { role: "PARTICIPANT", status: "ACTIVE", phone: { not: null }, phoneE164: null }, select: { id: true, name: true, email: true, phone: true, phoneE164: true, image: true } });
  const matches = [...direct, ...legacy.filter((user) => resolveStoredMobile(user.phoneE164, user.phone) === normalized)];
  if (matches.length > 1) throw new Error("Contato duplicado: mais de um cadastro usa este WhatsApp.");
  const user = matches[0];
  return user ? { id: user.id, name: user.name, email: user.email, phone: normalized, image: user.image } : null;
}

export async function confirmParticipantContact(input: { userId: string; name: string; email: string; phone: string; adminUserId: string; baseUrl: string }) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const phone = normalizeBrazilianMobile(input.phone);
  if (name.length < 2 || name.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Confira o nome e o e-mail antes de confirmar.");
  }
  const user = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, role: true, status: true, email: true } });
    if (!current || current.role !== "PARTICIPANT" || current.status !== "ACTIVE") throw new Error("Participante ativo não encontrado.");
    const emailOwner = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (emailOwner && emailOwner.id !== current.id) throw new Error("Contato duplicado: e-mail já pertence a outro cadastro.");
    const phoneOwner = await tx.user.findUnique({ where: { phoneE164: phone }, select: { id: true } });
    if (phoneOwner && phoneOwner.id !== current.id) throw new Error("Contato duplicado: WhatsApp já pertence a outro cadastro.");
    const legacy = await tx.user.findMany({ where: { phone: { not: null }, id: { not: current.id } }, select: { phone: true, phoneE164: true } });
    if (legacy.some((item) => resolveStoredMobile(item.phoneE164, item.phone) === phone)) throw new Error("Contato duplicado: WhatsApp já pertence a outro cadastro.");
    const updated = await tx.user.update({ where: { id: current.id }, data: { name, email, phone, phoneE164: phone }, select: { id: true, name: true, email: true, phoneE164: true } });
    await tx.invitation.updateMany({ where: { usedById: current.id }, data: { claimedName: name, claimedEmail: email, recipientPhoneE164: phone } });
    await createAuditLog({ actorUserId: input.adminUserId, actorRole: "ADMIN", action: "PARTICIPANT_CONTACT_CONFIRMED", entity: "User", entityId: current.id, details: { emailChanged: current.email !== email, phoneConfirmed: true }, tx });
    return updated;
  });
  const url = `${input.baseUrl.replace(/\/$/, "")}/login`;
  const message = buildCampaignMessage({ kind: "LOGIN", name: user.name, url });
  return { user, whatsappUrl: `https://api.whatsapp.com/send?phone=${user.phoneE164!.replace(/\D/g, "")}&text=${encodeURIComponent(message.text)}` };
}
