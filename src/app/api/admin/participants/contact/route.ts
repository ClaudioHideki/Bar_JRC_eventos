import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { findParticipantContact, confirmParticipantContact } from "@/lib/domain/participant-contact";

async function authorize(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session?.user) return { error: NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 }) };
  if (session.user.role !== "ADMIN") return { error: NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 }) };
  return { user: session.user };
}

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if (auth.error) return auth.error;
  try {
    const phone = req.nextUrl.searchParams.get("phone") || "";
    const contact = await findParticipantContact(phone);
    if (!contact) return NextResponse.json({ error: "Nenhum participante ativo encontrado com esse WhatsApp." }, { status: 404 });
    return NextResponse.json(contact, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao localizar contato." }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (auth.error) return auth.error;
  try {
    const body = await req.json();
    if (![body?.userId, body?.name, body?.email, body?.phone].every((value) => typeof value === "string")) {
      return NextResponse.json({ error: "Confira os dados do participante." }, { status: 400 });
    }
    const result = await confirmParticipantContact({ userId: body.userId, name: body.name, email: body.email, phone: body.phone, adminUserId: auth.user!.id, baseUrl: process.env.APP_URL || req.nextUrl.origin });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao confirmar dados." }, { status: 400 });
  }
}
