import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getWheelState, saveWheelSettings } from "@/lib/domain/wheel-service";

async function authorize(req: NextRequest) {
  const session = await getServerSession(req);
  return session?.user;
}

export async function GET(req: NextRequest) {
  const user = await authorize(req);
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  try { return NextResponse.json(await getWheelState()); }
  catch { return NextResponse.json({ error: "Erro ao carregar a roleta." }, { status: 500 }); }
}

export async function PUT(req: NextRequest) {
  const user = await authorize(req);
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  try {
    const body = await req.json();
    if (!Array.isArray(body?.prizes)) return NextResponse.json({ error: "Lista de prêmios inválida." }, { status: 400 });
    return NextResponse.json(await saveWheelSettings(body.prizes, user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao salvar a roleta." }, { status: 400 });
  }
}
