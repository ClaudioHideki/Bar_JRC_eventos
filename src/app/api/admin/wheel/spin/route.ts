import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { spinWheel } from "@/lib/domain/wheel-service";

export async function POST(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session?.user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  try { return NextResponse.json(await spinWheel(session.user.id)); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao girar a roleta." }, { status: 400 });
  }
}
