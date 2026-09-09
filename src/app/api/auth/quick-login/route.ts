import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateSecureToken } from "@/lib/security/crypto";
import { UserRole } from "@prisma/client";

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

    let targetEmail = "admin@jrc.com.br";
    let redirectPath = "/admin";

    if (role === "ATTENDANT") {
      targetEmail = "atendente@jrc.com.br";
      redirectPath = "/atendimento";
    }

    const user = await prisma.user.findFirst({
      where: { email: targetEmail },
    });

    if (!user) {
      return NextResponse.json({ error: `Usuário ${targetEmail} não encontrado.` }, { status: 404 });
    }

    // Cria nova sessão válida por 7 dias
    const token = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
        userAgent: req.headers.get("user-agent") || undefined,
      },
    });

    const response = NextResponse.json({
      success: true,
      redirectPath,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    // Define o cookie de sessão do Better Auth
    response.cookies.set("better-auth.session_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return response;
  } catch (err: unknown) {
    console.error("Erro no login rápido:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao autenticar." },
      { status: 500 }
    );
  }
}
