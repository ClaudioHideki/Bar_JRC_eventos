import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { voidWheelSpins } from "@/lib/domain/wheel-service";

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session?.user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  try {
    const body = await req.json();
    if (body?.mode !== "ALL" && !(body?.mode === "ONE" && typeof body.spinId === "string" && body.spinId.length > 0)) {
      return NextResponse.json({ error: "Selecione um giro ou a limpeza do histórico." }, { status: 400 });
    }
    return NextResponse.json(await voidWheelSpins(body, session.user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao excluir giros." }, { status: 400 });
  }
}
