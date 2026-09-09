import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

export async function POST(req: NextRequest) {
  // SEGURANÇA: Endpoint disponível apenas em ambiente de desenvolvimento
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Endpoint indisponível em produção." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { role } = body;

    const isAttendant = role === "ATTENDANT";
    const targetEmail = isAttendant ? "atendente@jrc.com" : "admin@jrc.com";
    const targetPassword = isAttendant ? "atendente123" : "admin123";
    const redirectPath = isAttendant ? "/atendimento" : "/admin";

    const signInRes = await auth.api.signInEmail({
      body: {
        email: targetEmail,
        password: targetPassword,
      },
      headers: req.headers,
      asResponse: true,
    });

    if (!signInRes.ok) {
      const errData = await signInRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData.message || "Falha ao autenticar usuário." },
        { status: 401 }
      );
    }

    const data = await signInRes.json().catch(() => ({}));
    const setCookie = signInRes.headers.get("set-cookie");

    const response = NextResponse.json({
      success: true,
      redirectPath,
      user: data.user,
    });

    if (setCookie) {
      response.headers.set("set-cookie", setCookie);
    }

    return response;
  } catch (err: unknown) {
    console.error("Erro no login rápido:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao autenticar." },
      { status: 500 }
    );
  }
}
