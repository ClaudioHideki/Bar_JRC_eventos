import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { validateQrToken } from "@/lib/domain/stamps";
import { prisma } from "@/lib/db/prisma";
import { UserRole, StampStatus } from "@prisma/client";

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

    // 1. Valida QR Token
    const challenge = await validateQrToken(qrToken);

    // 2. Valida Evento
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event || event.status !== "ACTIVE") {
      return NextResponse.json({ error: "Evento selecionado não está ativo." }, { status: 400 });
    }

    // 3. Verifica se já possui carimbo confirmado
    const existingStamp = await prisma.stamp.findFirst({
      where: {
        passportId: challenge.passportId,
        eventId,
        status: StampStatus.CONFIRMED,
      },
    });

    return NextResponse.json(
      {
        participantName: challenge.passport.user.name,
        passportNumber: challenge.passport.passportNumber,
        programName: challenge.passport.program.name,
        eventName: event.name,
        alreadyStamped: !!existingStamp,
        readyToStamp: !existingStamp,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao validar QR Code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
