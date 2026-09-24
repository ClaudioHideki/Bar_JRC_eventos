import { NextRequest, NextResponse } from "next/server";
import { requestPasswordRecovery } from "@/lib/domain/password-recovery";

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (process.env.NODE_ENV === "production" && !(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)) {
      return NextResponse.json({ message: "O envio automático de e-mail não está disponível. Peça ao administrador um link de recuperação pelo WhatsApp." });
    }
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const devResetUrl = await requestPasswordRecovery(String(phone || ""), ipAddress, process.env.APP_URL || req.nextUrl.origin);
    return NextResponse.json({ message: "Se o WhatsApp estiver cadastrado, você receberá instruções no e-mail da conta.",
      ...(process.env.NODE_ENV !== "production" && devResetUrl ? { devResetUrl } : {}) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Tente novamente mais tarde.";
    return NextResponse.json({ error: message }, { status: message.includes("Muitas") ? 429 : 503 });
  }
}
