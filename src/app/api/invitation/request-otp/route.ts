import { NextRequest, NextResponse } from "next/server";
import { requestInvitationOtp } from "@/lib/domain/registration";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, name, email } = body;

    if (!token || !name || !email) {
      return NextResponse.json(
        { error: "Token de convite, nome completo e e-mail são obrigatórios." },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

    const result = await requestInvitationOtp({
      token,
      name,
      email,
      ipAddress,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao processar convite.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
