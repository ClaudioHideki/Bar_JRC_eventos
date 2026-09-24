import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { buildCampaignMessage, campaignKindForStatus, matchingRegisteredRecipients } from "@/lib/domain/campaign-message";
import { encryptInvitationToken, generateSecureToken, hashInvitationToken } from "@/lib/security/crypto";
import { createAuditLog } from "@/lib/domain/audit";
import { resolveStoredMobile } from "@/lib/security/phone";

type Result = { id: string; name: string; phone?: string; kind: "LOGIN" | "INVITATION"; status: "PREPARED" | "FAILED" | "SKIPPED"; detail?: string; whatsappUrl?: string };

export async function POST(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  let cursor: string | undefined;
  try {
    const body = await req.json();
    cursor = typeof body.cursor === "string" ? body.cursor : undefined;
    if (body.mode !== "PREPARE") throw new Error("Modo inválido.");
  } catch {
    return NextResponse.json({ error: "Selecione a preparação da lista de WhatsApp." }, { status: 400 });
  }

  const program = await prisma.program.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
  if (!program) return NextResponse.json({ error: "Programa ativo não encontrado." }, { status: 404 });
  const invitations = await prisma.invitation.findMany({
    where: { programId: program.id, status: { in: ["AVAILABLE", "SENT", "USED", "EXPIRED"] } },
    include: { usedBy: { select: { name: true, phoneE164: true, phone: true } } },
    orderBy: { id: "asc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const nextCursor = invitations.length > 50 ? invitations[49].id : null;
  const registeredUsers = await prisma.user.findMany({
    where: { role: "PARTICIPANT", status: "ACTIVE", OR: [{ phoneE164: { not: null } }, { phone: { not: null } }] },
    select: { id: true, name: true, phoneE164: true, phone: true },
  });
  const baseUrl = (process.env.APP_URL || req.nextUrl.origin).replace(/\/$/, "");
  const results: Result[] = [];

  for (const invitation of invitations.slice(0, 50)) {
    let kind = campaignKindForStatus(invitation.status)!;
    let name = invitation.usedBy?.name || invitation.claimedName || "participante";
    const phone = resolveStoredMobile(invitation.usedBy?.phoneE164, invitation.usedBy?.phone)
      || resolveStoredMobile(invitation.recipientPhoneE164, invitation.phone);
    if (!phone) {
      results.push({ id: invitation.id, name, kind, status: "SKIPPED", detail: "Sem WhatsApp cadastrado." });
      continue;
    }
    const registeredMatches = matchingRegisteredRecipients(phone, registeredUsers);
    if (registeredMatches.length > 1) {
      results.push({ id: invitation.id, name, phone, kind, status: "SKIPPED", detail: "WhatsApp vinculado a mais de um cadastro. Corrija os dados antes de preparar a mensagem." });
      continue;
    }
    if (registeredMatches.length === 1) {
      kind = "LOGIN";
      name = registeredMatches[0].name;
    }
    try {
      let url = `${baseUrl}/login`;
      if (kind === "INVITATION") {
        const rawToken = generateSecureToken(32);
        await prisma.$transaction(async (tx) => {
          const locked = await tx.$queryRaw<Array<{ status: string; expiresAt: Date | null }>>`
            SELECT "status", "expiresAt" FROM "Invitation" WHERE "id" = ${invitation.id} FOR UPDATE
          `;
          if (!locked[0] || !["AVAILABLE", "SENT", "EXPIRED"].includes(locked[0].status)) {
            throw new Error("O convite mudou de estado. Atualize a lista.");
          }
          const needsReactivation = locked[0].status === "EXPIRED" || (locked[0].expiresAt && locked[0].expiresAt <= new Date());
          if (needsReactivation) {
            await tx.$queryRaw`SELECT "id" FROM "Program" WHERE "id" = ${program.id} FOR UPDATE`;
            if (locked[0].status === "EXPIRED") {
              const activeCount = await tx.invitation.count({
                where: { programId: program.id, status: { in: ["AVAILABLE", "SENT", "USED"] } },
              });
              if (activeCount >= program.capacity) throw new Error("Capacidade esgotada para reativar o convite.");
            }
            const primaryToken = generateSecureToken(32);
            await tx.invitationDeliveryToken.deleteMany({ where: { invitationId: invitation.id } });
            await tx.invitation.update({
              where: { id: invitation.id },
              data: {
                tokenHash: hashInvitationToken(primaryToken),
                tokenEncrypted: encryptInvitationToken(primaryToken),
                status: "SENT",
                sentAt: new Date(),
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
        });
        url = `${baseUrl}/convite/${rawToken}`;
      }
      const message = buildCampaignMessage({ kind, name, url });
      const whatsappUrl = phone
        ? `https://api.whatsapp.com/send?phone=${phone.replace(/\D/g, "")}&text=${encodeURIComponent(message.text)}`
        : undefined;
      await createAuditLog({
        actorUserId: session.user.id, actorRole: "ADMIN", action: "CAMPAIGN_WHATSAPP_PREPARED",
        entity: "Invitation", entityId: invitation.id, details: { kind },
      });
      results.push({ id: invitation.id, name, phone, kind, status: "PREPARED", whatsappUrl });
    } catch {
      results.push({ id: invitation.id, name, kind, status: "FAILED", detail: "Falha no preparo ou envio. Os links anteriores permanecem válidos; tente novamente." });
    }
  }
  return NextResponse.json({ results, nextCursor });
}
