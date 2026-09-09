import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { generateQrChallengeForUser } from "@/lib/domain/qr";
import { UserRole } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (session.user.role !== UserRole.PARTICIPANT) {
      return NextResponse.json(
        { error: "Apenas participantes podem gerar QR Code. Conecte-se com sua conta de participante." },
        { status: 403 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const challenge = await generateQrChallengeForUser({
      userId: session.user.id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(challenge, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao gerar QR Code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
