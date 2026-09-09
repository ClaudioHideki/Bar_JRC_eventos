import { NextRequest, NextResponse } from "next/server";
import { getLastTestOtp } from "@/lib/email/sender";

export async function GET(req: NextRequest) {
  // CRÍTICO: Esta rota é restrita a ambientes que não sejam produção
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "E-mail obrigatório" }, { status: 400 });
  }

  const otp = getLastTestOtp(email);
  if (!otp) {
    return NextResponse.json({ error: "Nenhum OTP encontrado para este e-mail" }, { status: 404 });
  }

  return NextResponse.json({ otp }, { status: 200 });
}
