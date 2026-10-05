import { prisma } from "../db/prisma";
import { createAuditLog } from "./audit";
import { buildCampaignMessage, campaignKindForStatus, matchingRegisteredRecipients } from "./campaign-message";
import { encryptInvitationToken, generateSecureToken, hashInvitationToken } from "../security/crypto";
import { resolveStoredMobile } from "../security/phone";

export type RegisteredContact = {
  id: string;
  name: string;
  phoneE164: string | null;
  phone: string | null;
  image: string | null;
};

export type PreparedInvitationWhatsapp = {
  id: string;
  name: string;
  phone?: string;
  imageUrl?: string | null;
  kind: "LOGIN" | "INVITATION";
  status: "PREPARED" | "FAILED" | "SKIPPED";
  detail?: string;
  whatsappUrl?: string;
};

export async function prepareInvitationWhatsapp(input: {
  invitationId: string;
  actorUserId: string;
  baseUrl: string;
  registeredUsers?: RegisteredContact[];
}): Promise<PreparedInvitationWhatsapp> {
  const invitation = await prisma.invitation.findUnique({
    where: { id: input.invitationId },
    include: {
      program: { select: { id: true, status: true, capacity: true } },
      usedBy: { select: { name: true, phoneE164: true, phone: true, image: true } },
    },
  });
  if (!invitation || invitation.program.status !== "ACTIVE") {
    throw new Error("Convite ou programa ativo não encontrado.");
  }
  let kind = campaignKindForStatus(invitation.status);
  if (!kind) throw new Error("Convite revogado não pode ser preparado.");
  let name = invitation.usedBy?.name || invitation.claimedName || "participante";
  const phone = resolveStoredMobile(invitation.usedBy?.phoneE164, invitation.usedBy?.phone)
    || resolveStoredMobile(invitation.recipientPhoneE164, invitation.phone);
  if (!phone) {
    return { id: invitation.id, name, kind, status: "SKIPPED", detail: "Sem WhatsApp válido cadastrado." };
  }
  const registeredUsers = input.registeredUsers || await prisma.user.findMany({
    where: { role: "PARTICIPANT", status: "ACTIVE", OR: [{ phoneE164: { not: null } }, { phone: { not: null } }] },
    select: { id: true, name: true, phoneE164: true, phone: true, image: true },
  });
  const matches = matchingRegisteredRecipients(phone, registeredUsers);
  if (matches.length > 1) {
    return { id: invitation.id, name, phone, kind, status: "SKIPPED", detail: "Contato duplicado: WhatsApp vinculado a mais de um cadastro." };
  }
  const registered = matches[0];
  if (registered) {
    kind = "LOGIN";
    name = registered.name;
  } else if (kind === "LOGIN") {
    return { id: invitation.id, name, phone, kind, status: "SKIPPED", detail: "Cadastro usado sem participante ativo; confira o contato." };
  }

  const baseUrl = input.baseUrl.replace(/\/$/, "");
  let url = `${baseUrl}/login`;
  if (kind === "INVITATION") {
    const rawToken = generateSecureToken(32);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Program" WHERE "id" = ${invitation.programId} FOR UPDATE`;
      const locked = await tx.$queryRaw<Array<{ status: string; expiresAt: Date | null }>>`
        SELECT "status", "expiresAt" FROM "Invitation" WHERE "id" = ${invitation.id} FOR UPDATE
      `;
      if (!locked[0] || !["AVAILABLE", "SENT", "EXPIRED"].includes(locked[0].status)) {
        throw new Error("O convite mudou de estado. Atualize a lista.");
      }
      const needsReactivation = locked[0].status === "EXPIRED" ||
        (locked[0].expiresAt !== null && locked[0].expiresAt <= new Date());
      if (needsReactivation) {
        if (locked[0].status === "EXPIRED") {
          const activeCount = await tx.invitation.count({
            where: { programId: invitation.programId, status: { in: ["AVAILABLE", "SENT", "USED"] } },
          });
          if (activeCount >= invitation.program.capacity) throw new Error("Capacidade esgotada para reativar o convite.");
        }
        const primaryToken = generateSecureToken(32);
        await tx.invitationDeliveryToken.deleteMany({ where: { invitationId: invitation.id } });
        await tx.invitation.update({
          where: { id: invitation.id },
          data: {
            tokenHash: hashInvitationToken(primaryToken),
            tokenEncrypted: encryptInvitationToken(primaryToken),
            status: "SENT", sentAt: new Date(),
          },
        });
      }
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      });
      await tx.invitationDeliveryToken.create({
        data: { invitationId: invitation.id, tokenHash: hashInvitationToken(rawToken) },
      });
      await createAuditLog({
        actorUserId: input.actorUserId, actorRole: "ADMIN", action: "CAMPAIGN_WHATSAPP_PREPARED",
        entity: "Invitation", entityId: invitation.id, details: { kind }, tx,
      });
    });
    url = `${baseUrl}/convite/${rawToken}`;
  } else {
    await createAuditLog({
      actorUserId: input.actorUserId, actorRole: "ADMIN", action: "CAMPAIGN_WHATSAPP_PREPARED",
      entity: "Invitation", entityId: invitation.id, details: { kind },
    });
  }
  const message = buildCampaignMessage({ kind, name, url });
  return {
    id: invitation.id, name, phone, imageUrl: registered?.image || invitation.usedBy?.image || null,
    kind, status: "PREPARED",
    whatsappUrl: `https://api.whatsapp.com/send?phone=${phone.replace(/\D/g, "")}&text=${encodeURIComponent(message.text)}`,
  };
}
