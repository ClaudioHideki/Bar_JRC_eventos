import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { cancelStamp } from "@/lib/domain/stamps";
import { UserRole } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }

    const body = await req.json();
    const { stampId, reason } = body;

    if (!stampId || !reason) {
      return NextResponse.json(
        { error: "ID do carimbo e justificativa são obrigatórios." },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const cancelled = await cancelStamp({
      stampId,
      adminUserId: session.user.id,
      reason,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(cancelled, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao cancelar carimbo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
