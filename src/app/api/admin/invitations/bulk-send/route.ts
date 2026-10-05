import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { prepareInvitationWhatsapp, type PreparedInvitationWhatsapp } from "@/lib/domain/invitation-delivery";

export async function POST(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente como administrador." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Esta conta não tem perfil de administrador." }, { status: 403 });
  }
  let cursor: string | undefined;
  let invitationId: string | undefined;
  try {
    const body = await req.json();
    if (body.mode !== "PREPARE") throw new Error("Modo inválido.");
    cursor = typeof body.cursor === "string" ? body.cursor : undefined;
    invitationId = typeof body.invitationId === "string" ? body.invitationId : undefined;
  } catch {
    return NextResponse.json({ error: "Selecione a preparação da lista de WhatsApp." }, { status: 400 });
  }
  const program = await prisma.program.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
  if (!program) return NextResponse.json({ error: "Programa ativo não encontrado." }, { status: 404 });
  const invitations = await prisma.invitation.findMany({
    where: { programId: program.id, status: { in: ["AVAILABLE", "SENT", "USED", "EXPIRED"] },
      ...(invitationId ? { id: invitationId } : {}) },
    select: { id: true, claimedName: true },
    orderBy: { id: "asc" },
    take: invitationId ? 1 : 51,
    ...(!invitationId && cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  if (invitationId && invitations.length === 0) {
    return NextResponse.json({ error: "Convite não encontrado ou sem permissão de reenvio." }, { status: 404 });
  }
  const nextCursor = !invitationId && invitations.length > 50 ? invitations[49].id : null;
  const registeredUsers = await prisma.user.findMany({
    where: { role: "PARTICIPANT", status: "ACTIVE", OR: [{ phoneE164: { not: null } }, { phone: { not: null } }] },
    select: { id: true, name: true, phoneE164: true, phone: true, image: true },
  });
  const baseUrl = process.env.APP_URL || req.nextUrl.origin;
  const results: PreparedInvitationWhatsapp[] = [];
  for (const invitation of invitations.slice(0, 50)) {
    try {
      results.push(await prepareInvitationWhatsapp({
        invitationId: invitation.id, actorUserId: session.user.id, baseUrl, registeredUsers,
      }));
    } catch {
      results.push({
        id: invitation.id, name: invitation.claimedName || "participante", kind: "INVITATION", status: "FAILED",
        detail: "Não foi possível preparar a conversa. Atualize a lista e tente novamente.",
      });
    }
  }
  return NextResponse.json({ results, nextCursor }, { headers: { "Cache-Control": "no-store" } });
}
