import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { confirmStamp } from "@/lib/domain/stamps";
import { UserRole } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (session.user.role !== UserRole.ATTENDANT && session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Acesso restrito a atendentes e administradores." }, { status: 403 });
    }

    const body = await req.json();
    const { qrToken, eventId } = body;

    if (!qrToken || !eventId) {
      return NextResponse.json({ error: "QR Token e Evento são obrigatórios." }, { status: 400 });
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const stamp = await confirmStamp({
      qrToken,
      eventId,
      attendantUserId: session.user.id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Carimbo registrado com sucesso!",
        stamp: {
          id: stamp.id,
          participantName: stamp.passport.user.name,
          eventName: stamp.event.name,
          stampedAt: stamp.stampedAt,
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao confirmar carimbo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
