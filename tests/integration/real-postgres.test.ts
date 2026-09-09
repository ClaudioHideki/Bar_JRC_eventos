import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, UserRole, UserStatus, InvitationStatus, StampStatus, QrChallengeStatus } from "@prisma/client";
import { generateInvitationBatch, revokeInvitation } from "../../src/lib/domain/invitations";
import { requestInvitationOtp, confirmInvitationOtpAndCreatePassport } from "../../src/lib/domain/registration";
import { generateQrChallengeForUser } from "../../src/lib/domain/qr";
import { confirmStamp, cancelStamp } from "../../src/lib/domain/stamps";
import { checkRateLimit, cleanupExpiredBuckets } from "../../src/lib/rate-limit/postgres-rate-limit";
import { getLastTestOtp } from "../../src/lib/email/sender";

const testDbUrl = "postgresql://jrc_test_user:jrc_test_password@localhost:5433/jrc_passaporte_test?schema=public";
process.env.DATABASE_URL = testDbUrl;
process.env.INVITATION_TOKEN_SECRET = "test_invitation_secret_must_be_32_chars_min";
process.env.QR_TOKEN_SECRET = "test_qr_secret_must_be_32_chars_min_length";
process.env.RATE_LIMIT_SECRET = "test_rate_limit_secret_32_chars_minimum";
process.env.BETTER_AUTH_SECRET = "test_better_auth_secret_32_chars_minimum";

const prisma = new PrismaClient({
  datasources: { db: { url: testDbUrl } },
});

describe("Integração com PostgreSQL Real (Docker porta 5433)", () => {
  beforeAll(async () => {
    // Limpa tabelas de teste
    await prisma.auditLog.deleteMany();
    await prisma.stamp.deleteMany();
    await prisma.qrChallenge.deleteMany();
    await prisma.passport.deleteMany();
    await prisma.pendingRegistration.deleteMany();
    await prisma.invitation.deleteMany();
    await prisma.event.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.verification.deleteMany();
    await prisma.rateLimitBucket.deleteMany();
    await prisma.user.deleteMany();
    await prisma.program.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("1. Limite rigoroso de 30 convites no Programa", async () => {
    // Cria programa de 30 vagas
    const program = await prisma.program.create({
      data: {
        name: "Passaporte JRC 2026",
        slug: "passaporte-jrc-2026",
        capacity: 30,
      },
    });

    expect(program.capacity).toBe(30);

    // Gera exatamente 30 convites
    const batch = await generateInvitationBatch({
      count: 30,
      baseUrl: "http://localhost:3000",
    });

    expect(batch).toHaveLength(30);

    // Tentativa de gerar o 31º convite DEVE falhar com erro de capacidade
    await expect(
      generateInvitationBatch({
        count: 1,
        baseUrl: "http://localhost:3000",
      })
    ).rejects.toThrow(/Limite de capacidade atingido/);
  });

  it("2. Substituição de convite revogado mantendo o teto de 30", async () => {
    const invites = await prisma.invitation.findMany({
      where: { status: InvitationStatus.AVAILABLE },
      take: 1,
    });
    expect(invites.length).toBe(1);

    const admin = await prisma.user.create({
      data: {
        email: "admin_test@jrc.com.br",
        name: "Admin Test",
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    // Revoga 1 convite
    await revokeInvitation({
      invitationId: invites[0].id,
      adminUserId: admin.id,
    });

    const revoked = await prisma.invitation.findUnique({
      where: { id: invites[0].id },
    });
    expect(revoked?.status).toBe(InvitationStatus.REVOKED);

    // Agora deve ser possível emitir exatamente 1 novo convite para substituir
    const newBatch = await generateInvitationBatch({
      count: 1,
      adminUserId: admin.id,
      baseUrl: "http://localhost:3000",
    });
    expect(newBatch).toHaveLength(1);

    // Tentativa adicional de mais 1 deve falhar novamente
    await expect(
      generateInvitationBatch({
        count: 1,
        adminUserId: admin.id,
        baseUrl: "http://localhost:3000",
      })
    ).rejects.toThrow(/Limite de capacidade atingido/);
  });

  it("3. Ativação de convite com OTP e criação atômica de Participante + Passaporte", async () => {
    // Pega um convite disponível
    const availableInvite = await prisma.invitation.findFirst({
      where: { status: InvitationStatus.AVAILABLE },
    });
    expect(availableInvite).toBeTruthy();

    const admin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
    await revokeInvitation({ invitationId: availableInvite!.id, adminUserId: admin!.id });

    const batch = await generateInvitationBatch({
      count: 1,
      adminUserId: admin!.id,
      baseUrl: "http://localhost:3000",
    });
    const { token } = batch[0];

    // Solicita OTP
    const email = "participante1@empresa.com.br";
    const reqResult = await requestInvitationOtp({
      token,
      name: "Participante Convidado 1",
      email,
      ipAddress: "127.0.0.1",
    });
    expect(reqResult.success).toBe(true);

    const otp = getLastTestOtp(email);
    expect(otp).toBeTruthy();
    expect(otp?.length).toBe(6);

    // Confirma OTP
    const confirmResult = await confirmInvitationOtpAndCreatePassport({
      token,
      email,
      otp: otp!,
      ipAddress: "127.0.0.1",
      userAgent: "Vitest-Agent",
    });

    expect(confirmResult.success).toBe(true);
    expect(confirmResult.user.email).toBe(email);
    expect(confirmResult.passport.passportNumber).toMatch(/^JRC-2026-[A-Z0-9]{4}$/);

    // Verifica no PostgreSQL que o convite foi marcado como USED
    const usedInv = await prisma.invitation.findUnique({
      where: { id: batch[0].id },
    });
    expect(usedInv?.status).toBe(InvitationStatus.USED);
    expect(usedInv?.usedById).toBe(confirmResult.user.id);

    // Tentar reutilizar o mesmo convite DEVE falhar
    await expect(
      requestInvitationOtp({
        token,
        name: "Intruso",
        email: "intruso@empresa.com.br",
        ipAddress: "127.0.0.1",
      })
    ).rejects.toThrow(/Este convite já foi utilizado ou não está mais ativo/);
  });

  it("4. Um e-mail não pode ter dois passaportes no mesmo programa", async () => {
    const admin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
    const avail = await prisma.invitation.findFirst({ where: { status: InvitationStatus.AVAILABLE } });
    await revokeInvitation({ invitationId: avail!.id, adminUserId: admin!.id });
    const batch = await generateInvitationBatch({ count: 1, adminUserId: admin!.id, baseUrl: "http://localhost:3000" });

    // Tentar cadastrar o mesmo e-mail já existente
    await expect(
      requestInvitationOtp({
        token: batch[0].token,
        name: "Tentativa Duplicada",
        email: "participante1@empresa.com.br",
        ipAddress: "127.0.0.1",
      })
    ).rejects.toThrow(/Este e-mail já possui um passaporte ativo no programa/);
  });

  it("5. Geração de QR Code temporário e uso único", async () => {
    const user = await prisma.user.findUnique({
      where: { email: "participante1@empresa.com.br" },
    });
    expect(user).toBeTruthy();

    // Gera primeiro QR
    const qr1 = await generateQrChallengeForUser({
      userId: user!.id,
      ipAddress: "127.0.0.1",
    });
    expect(qr1.token).toHaveLength(64);

    // Gera segundo QR (deve revogar o primeiro)
    const qr2 = await generateQrChallengeForUser({
      userId: user!.id,
      ipAddress: "127.0.0.1",
    });

    const qr1Db = await prisma.qrChallenge.findFirst({
      where: { passport: { userId: user!.id }, status: QrChallengeStatus.REVOKED },
    });
    expect(qr1Db).toBeTruthy();
  });

  it("6. Validação de Carimbo, concorrência e índice parcial único", async () => {
    const user = await prisma.user.findUnique({
      where: { email: "participante1@empresa.com.br" },
    });
    const program = await prisma.program.findFirst();

    // Cria atendente
    const attendant = await prisma.user.create({
      data: {
        email: "atendente1@jrc.com.br",
        name: "Atendente Evento",
        role: UserRole.ATTENDANT,
        status: UserStatus.ACTIVE,
      },
    });

    // Cria evento ACTIVE
    const event = await prisma.event.create({
      data: {
        programId: program!.id,
        name: "Abertura JRC 2026",
        startDate: new Date(),
        endDate: new Date(Date.now() + 3600000),
        status: "ACTIVE",
      },
    });

    // Gera QR válido
    const qr = await generateQrChallengeForUser({
      userId: user!.id,
      ipAddress: "127.0.0.1",
    });

    // Confirma carimbo
    const stamp = await confirmStamp({
      qrToken: qr.token,
      eventId: event.id,
      attendantUserId: attendant.id,
      ipAddress: "127.0.0.1",
    });

    expect(stamp.status).toBe(StampStatus.CONFIRMED);
    expect(stamp.passportId).toBeDefined();

    // Tentar reutilizar o mesmo QR DEVE falhar (QR de uso único)
    await expect(
      confirmStamp({
        qrToken: qr.token,
        eventId: event.id,
        attendantUserId: attendant.id,
      })
    ).rejects.toThrow(/não está ativo ou expirou/);

    // Gera novo QR e tenta carimbar O MESMO EVENTO novamente (deve falhar por carimbo duplicado)
    const qrNovo = await generateQrChallengeForUser({
      userId: user!.id,
    });

    await expect(
      confirmStamp({
        qrToken: qrNovo.token,
        eventId: event.id,
        attendantUserId: attendant.id,
      })
    ).rejects.toThrow(/já possui carimbo confirmado neste evento/);
  });

  it("7. Cancelamento justificado e novo carimbo subsequente", async () => {
    const user = await prisma.user.findUnique({
      where: { email: "participante1@empresa.com.br" },
    });
    const event = await prisma.event.findFirst({ where: { status: "ACTIVE" } });
    const admin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
    const attendant = await prisma.user.findFirst({ where: { role: UserRole.ATTENDANT } });

    const existingStamp = await prisma.stamp.findFirst({
      where: { passport: { userId: user!.id }, eventId: event!.id },
    });
    expect(existingStamp).toBeTruthy();

    // Admin cancela com justificativa
    const cancelled = await cancelStamp({
      stampId: existingStamp!.id,
      adminUserId: admin!.id,
      reason: "Participante precisou sair mais cedo por emergência",
    });

    expect(cancelled.status).toBe(StampStatus.CANCELLED);
    expect(cancelled.cancellationReason).toContain("emergência");

    // Registro antigo CONTINUA no histórico (não foi deletado)
    const historyStamp = await prisma.stamp.findUnique({
      where: { id: existingStamp!.id },
    });
    expect(historyStamp).toBeTruthy();
    expect(historyStamp?.status).toBe(StampStatus.CANCELLED);

    // Novo carimbo agora é PERMITIDO com um novo QR Code (graças ao índice parcial único)
    const qrAfterCancel = await generateQrChallengeForUser({
      userId: user!.id,
    });

    const newStamp = await confirmStamp({
      qrToken: qrAfterCancel.token,
      eventId: event!.id,
      attendantUserId: attendant!.id,
    });

    expect(newStamp.status).toBe(StampStatus.CONFIRMED);
    expect(newStamp.id).not.toBe(existingStamp!.id);
  });

  it("8. Rate Limiting em PostgreSQL funcional e auditável", async () => {
    const testKey = "test-rate-limit-key-123";
    const limit = 3;
    const windowSeconds = 10;

    const r1 = await checkRateLimit({ key: testKey, limit, windowSeconds });
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await checkRateLimit({ key: testKey, limit, windowSeconds });
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await checkRateLimit({ key: testKey, limit, windowSeconds });
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    // 4ª chamada deve ser BLOQUEADA
    const r4 = await checkRateLimit({ key: testKey, limit, windowSeconds });
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);

    const cleaned = await cleanupExpiredBuckets();
    expect(typeof cleaned).toBe("number");
  });
});
