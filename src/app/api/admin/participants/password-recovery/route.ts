import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { prepareAdminPasswordRecovery } from "@/lib/domain/password-recovery";

export async function POST(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  try {
    const body = await req.json();
    if (typeof body.userId !== "string" || !body.userId) {
      return NextResponse.json({ error: "Participante não informado." }, { status: 400 });
    }
    const baseUrl = (process.env.APP_URL || req.nextUrl.origin).replace(/\/$/, "");
    const prepared = await prepareAdminPasswordRecovery(body.userId, baseUrl, session.user.id);
    if (!prepared) {
      return NextResponse.json({ error: "Participante sem WhatsApp válido ou sem acesso ativo." }, { status: 400 });
    }
    const message = `Olá, ${prepared.name}! Para definir uma nova senha do Passaporte JRC, acesse este link pessoal. Ele expira em 15 minutos e só pode ser usado uma vez:\n${prepared.url}`;
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${prepared.phoneE164.replace(/\D/g, "")}&text=${encodeURIComponent(message)}`;
    return NextResponse.json({ whatsappUrl, phone: prepared.phoneE164 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível preparar a recuperação de acesso." }, { status: 500 });
  }
}
