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
    const { token, name, email, password, realEstateAgency, birthDate, lgpdConsent } = body;

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

    if (!password || typeof password !== "string" || password.trim().length < 4) {
      return NextResponse.json(
        { error: "A senha ou data de nascimento deve ter pelo menos 4 caracteres." },
        { status: 400 }
      );
    }

    if (!realEstateAgency || typeof realEstateAgency !== "string" || realEstateAgency.trim().length < 2) {
      return NextResponse.json(
        { error: "Por favor, informe a sua imobiliária ou empresa parceira." },
        { status: 400 }
      );
    }

    if (!lgpdConsent) {
      return NextResponse.json(
        { error: "É obrigatório aceitar o Termo de Consentimento (LGPD) e o Regulamento da Campanha." },
        { status: 400 }
      );
    }

    // 2. Rate Limiting por IP e por E-mail
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

    const ipLimit = await checkRateLimit({
      key: `invite-reg-ip:${clientIp}`,
      limit: 5,
      windowSeconds: 300,
    });
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Muitas solicitações deste dispositivo. Aguarde alguns minutos." },
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
        { error: "Muitas tentativas para este e-mail. Aguarde alguns minutos." },
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
        { error: "Este e-mail já possui um passaporte ativo no programa. Acesse a tela de login para entrar." },
        { status: 409 }
      );
    }

    // 4. Transação com bloqueio pessimista (SELECT ... FOR UPDATE)
    const tokenHash = hashInvitationToken(token.trim());

    const txResult = await prisma.$transaction(async (tx) => {
      // Lock do convite
      const lockedInv = await tx.$queryRaw<Array<{ id: string; status: string; programId: string; claimedEmail: string | null }>>`
        SELECT "id", "status", "programId", "claimedEmail" FROM "Invitation" WHERE "tokenHash" = ${tokenHash} FOR UPDATE
      `;

      if (!lockedInv || lockedInv.length === 0) {
        throw new Error("Convite inválido ou inexistente.");
      }

      const inv = lockedInv[0];

      if (inv.status !== InvitationStatus.AVAILABLE && inv.status !== InvitationStatus.SENT) {
        throw new Error("Este convite já foi utilizado ou não está mais ativo.");
      }

      // Se o convite foi emitido nominalmente para um e-mail específico, confere
      if (inv.claimedEmail && inv.claimedEmail.toLowerCase() !== cleanEmail) {
        throw new Error(`Este convite foi emitido exclusivamente para o e-mail ${inv.claimedEmail}.`);
      }

      // Lock do Programa para checagem estrita da capacidade máxima (30) - AGENTS.md 2.1
      const lockedProgram = await tx.$queryRaw<Array<{ id: string; capacity: number }>>`
        SELECT "id", "capacity" FROM "Program" WHERE "id" = ${inv.programId} FOR UPDATE
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
        throw new Error(`Limite de capacidade atingido (${capacity} participantes). Não há mais vagas disponíveis.`);
      }

      // Cria/atualiza o PendingRegistration para autorizar a criação no hook do Better Auth
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min
      const pendingReg = await tx.pendingRegistration.upsert({
        where: { id: `reg_${inv.id}` },
        create: {
          id: `reg_${inv.id}`,
          programId: inv.programId,
          invitationId: inv.id,
          normalizedEmail: cleanEmail,
          name: name.trim(),
          status: RegistrationStatus.OTP_VERIFIED,
          expiresAt,
        },
        update: {
          normalizedEmail: cleanEmail,
          name: name.trim(),
          status: RegistrationStatus.OTP_VERIFIED,
          expiresAt,
        },
      });

      return {
        invitationId: inv.id,
        programId: inv.programId,
        pendingRegId: pendingReg.id,
      };
    });

    // 5. Cria o usuário via Better Auth (dispara os databaseHooks)
    const signUpRes = await auth.api.signUpEmail({
      body: {
        name: name.trim(),
        email: cleanEmail,
        password: password.trim(),
        realEstateAgency: realEstateAgency.trim(),
        birthDate: birthDate ? new Date(birthDate) : undefined,
        lgpdConsent: true,
      },
      headers: req.headers,
      asResponse: true,
    });

    if (!signUpRes.ok) {
      const errData = await signUpRes.json().catch(() => ({}));
      throw new Error(errData.message || errData.error || "Falha ao criar conta de acesso.");
    }

    // 6. Finaliza a ativação do convite
    const newUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { passports: true },
    });

    if (newUser) {
      // Marca convite como USED
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

      // Conclui pendingRegistration
      await prisma.pendingRegistration.update({
        where: { id: txResult.pendingRegId },
        data: {
          status: RegistrationStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      // Registra auditoria da ativação
      await createAuditLog({
        actorUserId: newUser.id,
        actorRole: "PARTICIPANT",
        action: "INVITATION_ACTIVATED",
        entity: "Passport",
        entityId: newUser.passports[0]?.id || txResult.invitationId,
        ipAddress: clientIp,
        userAgent: req.headers.get("user-agent") || undefined,
        details: {
          invitationId: txResult.invitationId,
          passportNumber: newUser.passports[0]?.passportNumber,
          realEstateAgency: realEstateAgency.trim(),
        },
      });

      // Registra auditoria do consentimento LGPD
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

    return signUpRes;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao processar ativação do convite.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
