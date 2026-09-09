import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { adminManualStamp } from "@/lib/domain/stamps";
import { UserRole } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }

    const body = await req.json();
    const { passportId, eventId, justification } = body;

    if (!passportId || !eventId || !justification) {
      return NextResponse.json(
        { error: "Passaporte, evento e justificativa são obrigatórios." },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const stamp = await adminManualStamp({
      passportId,
      eventId,
      adminUserId: session.user.id,
      justification,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(stamp, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro no carimbo manual de contingência.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
