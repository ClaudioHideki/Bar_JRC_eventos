import { NextRequest, NextResponse } from "next/server";
import { completePasswordRecovery } from "@/lib/domain/password-recovery";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    await completePasswordRecovery(String(token || ""), password, ipAddress);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível trocar a senha." }, { status: 400 });
  }
}
