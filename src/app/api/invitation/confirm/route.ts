import { NextRequest, NextResponse } from "next/server";
import { confirmInvitationOtpAndCreatePassport } from "@/lib/domain/registration";
import { prisma } from "@/lib/db/prisma";
import { generateSecureToken } from "@/lib/security/crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, email, otp } = body;

    if (!token || !email || !otp) {
      return NextResponse.json(
        { error: "Token de convite, e-mail e código OTP são obrigatórios." },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    // 1. Confirmação atômica no banco (User ACTIVE, Passport criado, Invitation USED)
    const result = await confirmInvitationOtpAndCreatePassport({
      token,
      email,
      otp,
      ipAddress,
      userAgent,
    });

    // 2. Emissão de Sessão compatível com Better Auth
    const rawSessionToken = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias

    await prisma.session.create({
      data: {
        userId: result.user.id,
        token: rawSessionToken,
        expiresAt,
        ipAddress,
        userAgent: userAgent || null,
      },
    });

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
        passport: {
          id: result.passport.id,
          passportNumber: result.passport.passportNumber,
        },
      },
      { status: 200 }
    );

    response.cookies.set("better-auth.session_token", rawSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao confirmar código.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
