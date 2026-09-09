import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { hashInvitationToken, normalizeEmail } from "@/lib/security/crypto";
import { createAuditLog } from "@/lib/domain/audit";
import { checkRateLimit } from "@/lib/rate-limit/postgres-rate-limit";
import { InvitationStatus, RegistrationStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      token,
      name,
      email,
      password,
      realEstateAgency,
      birthDate,
      lgpdConsent,
    } = body;

    // 1. Validações de Entrada
    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token de convite é obrigatório." },
        { status: 400 }
      );
    }

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Por favor, informe seu nome completo." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Por favor, informe um e-mail válido." },
        { status: 400 }
      );
    }

    const cleanEmail = normalizeEmail(email);

    if (
      !password ||
      typeof password !== "string" ||
      password.length < 4
    ) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 4 caracteres." },
        { status: 400 }
      );
    }

    if (
      !realEstateAgency ||
      typeof realEstateAgency !== "string" ||
      realEstateAgency.trim().length < 2
    ) {
      return NextResponse.json(
        {
          error:
            "Por favor, informe a sua imobiliária ou empresa parceira.",
        },
        { status: 400 }
      );
    }

    if (!lgpdConsent) {
      return NextResponse.json(
        {
          error:
            "É obrigatório aceitar o Termo de Consentimento (LGPD) e o Regulamento da Campanha.",
        },
        { status: 400 }
      );
    }

    // 2. Rate Limiting por IP e por E-mail
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    const ipLimit = await checkRateLimit({
      key: `invite-reg-ip:${clientIp}`,
      limit: 5,
      windowSeconds: 300,
    });

    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Muitas solicitações deste dispositivo. Aguarde alguns minutos.",
        },
        { status: 429 }
      );
    }

    const emailLimit = await checkRateLimit({
      key: `invite-reg-email:${cleanEmail}`,
      limit: 3,
      windowSeconds: 300,
    });

    if (!emailLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Muitas tentativas para este e-mail. Aguarde alguns minutos.",
        },
        { status: 429 }
      );
    }

    // 3. Verifica se o e-mail já possui passaporte cadastrado
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { passports: true },
    });

    if (existingUser && existingUser.passports.length > 0) {
      return NextResponse.json(
        {
          error:
            "Este e-mail já possui um passaporte ativo no programa. Acesse a tela de login para entrar.",
        },
        { status: 409 }
      );
    }

    // 4. Verificação rápida prévia do convite
    const tokenHash = hashInvitationToken(token.trim());

    const checkInv = await prisma.invitation.findFirst({
      where: { tokenHash },
      select: {
        id: true,
        status: true,
        programId: true,
        claimedEmail: true,
      },
    });

    if (!checkInv) {
      return NextResponse.json(
        {
          error:
            "Este link de convite é inválido ou já foi excluído no painel administrativo. Por favor, solicite um novo convite ao administrador.",
        },
        { status: 400 }
      );
    }

    if (
      checkInv.status !== InvitationStatus.AVAILABLE &&
      checkInv.status !== InvitationStatus.SENT
    ) {
      return NextResponse.json(
        {
          error:
            "Este convite já foi utilizado para ativar outro passaporte ou foi cancelado.",
        },
        { status: 400 }
      );
    }

    // 5. Transação com bloqueio pessimista
    const txResult = await prisma.$transaction(
      async (tx) => {
        const lockedInv = await tx.$queryRaw<
          Array<{
            id: string;
            status: string;
            programId: string;
            claimedEmail: string | null;
          }>
        >`
          SELECT "id", "status", "programId", "claimedEmail"
          FROM "Invitation"
          WHERE "tokenHash" = ${tokenHash}
          FOR UPDATE
        `;

        if (!lockedInv || lockedInv.length === 0) {
          throw new Error("Convite inválido ou inexistente.");
        }

        const inv = lockedInv[0];

        if (
          inv.status !== InvitationStatus.AVAILABLE &&
          inv.status !== InvitationStatus.SENT
        ) {
          throw new Error(
            "Este convite já foi utilizado ou não está mais ativo."
          );
        }

        if (
          inv.claimedEmail &&
          inv.claimedEmail.toLowerCase() !== cleanEmail
        ) {
          throw new Error(
            `Este convite foi emitido exclusivamente para o e-mail ${inv.claimedEmail}.`
          );
        }

        const lockedProgram = await tx.$queryRaw<
          Array<{ id: string; capacity: number }>
        >`
          SELECT "id", "capacity"
          FROM "Program"
          WHERE "id" = ${inv.programId}
          FOR UPDATE
        `;

        if (!lockedProgram || lockedProgram.length === 0) {
          throw new Error("Programa de fidelidade não encontrado.");
        }

        const capacity = lockedProgram[0].capacity;

        const usedCount = await tx.invitation.count({
          where: {
            programId: inv.programId,
            status: InvitationStatus.USED,
          },
        });

        if (usedCount >= capacity) {
          throw new Error(
            `Limite de capacidade atingido (${capacity} participantes). Não há mais vagas disponíveis.`
          );
        }

        // PendingRegistration autoriza criação do participante no hook do Better Auth
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        const pendingReg = await tx.pendingRegistration.upsert({
          where: { id: `reg_${inv.id}` },
          create: {
            id: `reg_${inv.id}`,
            programId: inv.programId,
            invitationId: inv.id,
            normalizedEmail: cleanEmail,
            name: name.trim(),
            status: RegistrationStatus.VERIFIED,
            expiresAt,
          },
          update: {
            normalizedEmail: cleanEmail,
            name: name.trim(),
            status: RegistrationStatus.VERIFIED,
            expiresAt,
          },
        });

        return {
          invitationId: inv.id,
          programId: inv.programId,
          pendingRegId: pendingReg.id,
        };
      },
      { maxWait: 15000, timeout: 30000 }
    );

    // 6. Cria usuário via Better Auth
    const cleanHeaders = new Headers();

    req.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "cookie") {
        cleanHeaders.set(key, value);
      }
    });

    const signUpRes = await auth.api.signUpEmail({
      body: {
        name: name.trim(),
        email: cleanEmail,
        password,
        realEstateAgency: realEstateAgency.trim(),
        birthDate: birthDate ? new Date(birthDate) : undefined,
        lgpdConsent: true,
      },
      headers: cleanHeaders,
      asResponse: true,
    });

    if (!signUpRes.ok) {
      const errData = await signUpRes.json().catch(() => ({}));

      throw new Error(
        errData.message ||
          errData.error ||
          "Falha ao criar conta de acesso."
      );
    }

    // 7. Finaliza a ativação do convite
    const newUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { passports: true },
    });

    if (newUser) {
      await prisma.invitation.update({
        where: { id: txResult.invitationId },
        data: {
          status: InvitationStatus.USED,
          usedById: newUser.id,
          usedAt: new Date(),
          claimedName: name.trim(),
          claimedEmail: cleanEmail,
        },
      });

      await prisma.pendingRegistration.update({
        where: { id: txResult.pendingRegId },
        data: {
          status: RegistrationStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      await createAuditLog({
        actorUserId: newUser.id,
        actorRole: "PARTICIPANT",
        action: "INVITATION_ACTIVATED",
        entity: "Passport",
        entityId:
          newUser.passports[0]?.id || txResult.invitationId,
        ipAddress: clientIp,
        userAgent: req.headers.get("user-agent") || undefined,
        details: {
          invitationId: txResult.invitationId,
          passportNumber:
            newUser.passports[0]?.passportNumber,
          realEstateAgency: realEstateAgency.trim(),
        },
      });

      await createAuditLog({
        actorUserId: newUser.id,
        actorRole: "PARTICIPANT",
        action: "LGPD_CONSENT_GIVEN",
        entity: "User",
        entityId: newUser.id,
        ipAddress: clientIp,
        userAgent: req.headers.get("user-agent") || undefined,
        details: {
          email: cleanEmail,
          realEstateAgency: realEstateAgency.trim(),
          version: "1.0-2026",
          acceptedAt: new Date().toISOString(),
        },
      });
    }

    const signUpData = await signUpRes
      .json()
      .catch(() => ({}));

    // signUpData vem primeiro para não sobrescrever o user/passportNumber
    const response = NextResponse.json(
      {
        ...signUpData,
        success: true,
        message: "Passaporte ativado com sucesso!",
        user: {
          id: newUser?.id,
          name: newUser?.name,
          email: newUser?.email,
          passportNumber:
            newUser?.passports[0]?.passportNumber,
        },
      },
      { status: 200 }
    );

    // Repassa os cookies da nova sessão do participante
    const setCookieHeaders =
      signUpRes.headers.getSetCookie?.() || [];

    if (setCookieHeaders.length > 0) {
      for (const cookie of setCookieHeaders) {
        response.headers.append("set-cookie", cookie);
      }
    } else {
      const setCookie =
        signUpRes.headers.get("set-cookie");

      if (setCookie) {
        response.headers.set("set-cookie", setCookie);
      }
    }

    return response;
  } catch (err: unknown) {
    const rawMessage =
      err instanceof Error
        ? err.message
        : "Erro ao processar ativação do convite.";

    const message = rawMessage.includes(
      "Unable to start a transaction"
    )
      ? "O banco de dados estava ocupado no momento. Por favor, tente clicar novamente para ativar."
      : rawMessage;

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
