import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  PrismaClient,
  UserRole,
  UserStatus,
  InvitationStatus,
  StampStatus,
  QrChallengeStatus,
} from "@prisma/client";
import { NextRequest } from "next/server";
import {
  generateInvitationBatch,
  revokeInvitation,
  getInvitationByToken,
} from "../../src/lib/domain/invitations";
import { generateQrChallengeForUser } from "../../src/lib/domain/qr";
import { confirmStamp, cancelStamp } from "../../src/lib/domain/stamps";
import {
  checkRateLimit,
  cleanupExpiredBuckets,
} from "../../src/lib/rate-limit/postgres-rate-limit";
import { POST as registerInvitation } from "../../src/app/api/invitation/register/route";
import { createEventReview } from "../../src/lib/domain/event-reviews";
import { completePasswordRecovery, prepareAdminPasswordRecovery, requestPasswordRecovery } from "../../src/lib/domain/password-recovery";
import { auth } from "../../src/lib/auth/auth";
import { withInvitationContext } from "../../src/lib/auth/invitation-context";
import { generateSecureToken, hashInvitationToken } from "../../src/lib/security/crypto";

const testDbUrl = process.env.DATABASE_URL ||
  "postgresql://jrc_test_user:jrc_test_password@localhost:5433/jrc_passaporte_test?schema=public";

process.env.DATABASE_URL = testDbUrl;
process.env.INVITATION_TOKEN_SECRET =
  "test_invitation_secret_must_be_32_chars_min";
process.env.QR_TOKEN_SECRET =
  "test_qr_secret_must_be_32_chars_min_length";
process.env.RATE_LIMIT_SECRET =
  "test_rate_limit_secret_32_chars_minimum";
process.env.BETTER_AUTH_SECRET =
  "test_better_auth_secret_32_chars_minimum";

const prisma = new PrismaClient({
  datasources: { db: { url: testDbUrl } },
});

function createRegisterRequest(body: {
  token: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  realEstateAgency: string;
  lgpdConsent: boolean;
}, ipAddress = "127.0.0.1") {
  return new NextRequest(
    "http://localhost:3000/api/invitation/register",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ipAddress,
        "user-agent": "Vitest-Agent",
      },
      body: JSON.stringify(body),
    }
  );
}

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

  it("3. Ativação de convite com senha cria Participante + Passaporte", async () => {
    // Pega um convite disponível
    const availableInvite = await prisma.invitation.findFirst({
      where: { status: InvitationStatus.AVAILABLE },
    });

    expect(availableInvite).toBeTruthy();

    const admin = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
    });

    await revokeInvitation({
      invitationId: availableInvite!.id,
      adminUserId: admin!.id,
    });

    const batch = await generateInvitationBatch({
      count: 1,
      adminUserId: admin!.id,
      baseUrl: "http://localhost:3000",
    });

    const { token } = batch[0];
    const email = "participante1@empresa.com.br";

    // Ativa o convite com senha, imobiliária e consentimento LGPD
    const registerResponse = await registerInvitation(
      createRegisterRequest({
        token,
        name: "Participante Convidado 1",
        email,
        phone: "11987654321",
        password: "senha123456",
        realEstateAgency: "Imobiliária Teste",
        lgpdConsent: true,
      })
    );

    const registerData = await registerResponse.json();

    expect(registerResponse.status).toBe(200);
    expect(registerData.success).toBe(true);
    expect(registerData.user.email).toBe(email);
    expect(registerData.user.passportNumber).toMatch(
      /^JRC-2026-[A-Z0-9]{4}$/
    );

    // Confirma criação do usuário no PostgreSQL
    const createdUser = await prisma.user.findUnique({
      where: { email },
      include: { passports: true },
    });

    expect(createdUser).toBeTruthy();
    expect(createdUser?.role).toBe(UserRole.PARTICIPANT);
    expect(createdUser?.passports).toHaveLength(1);
    expect(createdUser?.passports[0].passportNumber).toMatch(
      /^JRC-2026-[A-Z0-9]{4}$/
    );

    // Verifica que o convite foi marcado como USED
    const usedInv = await prisma.invitation.findUnique({
      where: { id: batch[0].id },
    });

    expect(usedInv?.status).toBe(InvitationStatus.USED);
    expect(usedInv?.usedById).toBe(createdUser?.id);

    // Tentar reutilizar o mesmo convite DEVE falhar
    const reuseResponse = await registerInvitation(
      createRegisterRequest({
        token,
        name: "Intruso",
        email: "intruso@empresa.com.br",
        phone: "11987654322",
        password: "senha123456",
        realEstateAgency: "Imobiliária Intruso",
        lgpdConsent: true,
      })
    );

    const reuseData = await reuseResponse.json();

    expect(reuseResponse.status).toBe(400);
    expect(reuseData.error).toMatch(
      /convite já foi utilizado|convite já foi utilizado para ativar outro passaporte|foi cancelado/i
    );

    const intruder = await prisma.user.findUnique({
      where: { email: "intruso@empresa.com.br" },
    });

    expect(intruder).toBeNull();
  });

  it("4. Um e-mail não pode ter dois passaportes no mesmo programa", async () => {
    const admin = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
    });

    const avail = await prisma.invitation.findFirst({
      where: { status: InvitationStatus.AVAILABLE },
    });

    await revokeInvitation({
      invitationId: avail!.id,
      adminUserId: admin!.id,
    });

    const batch = await generateInvitationBatch({
      count: 1,
      adminUserId: admin!.id,
      baseUrl: "http://localhost:3000",
    });

    // Tentar cadastrar o mesmo e-mail já existente
    const duplicateResponse = await registerInvitation(
      createRegisterRequest({
        token: batch[0].token,
        name: "Tentativa Duplicada",
        email: "participante1@empresa.com.br",
        phone: "11987654323",
        password: "outrasenha123",
        realEstateAgency: "Outra Imobiliária",
        lgpdConsent: true,
      })
    );

    const duplicateData = await duplicateResponse.json();

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateData.error).toMatch(
      /Este e-mail já possui um passaporte ativo no programa/i
    );

    const user = await prisma.user.findUnique({
      where: { email: "participante1@empresa.com.br" },
      include: { passports: true },
    });

    expect(user).toBeTruthy();
    expect(user?.passports).toHaveLength(1);
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

    expect(qr2.token).toHaveLength(64);
    expect(qr2.token).not.toBe(qr1.token);

    const qr1Db = await prisma.qrChallenge.findFirst({
      where: {
        passport: { userId: user!.id },
        status: QrChallengeStatus.REVOKED,
      },
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

    // Tentar reutilizar o mesmo QR DEVE falhar
    await expect(
      confirmStamp({
        qrToken: qr.token,
        eventId: event.id,
        attendantUserId: attendant.id,
      })
    ).rejects.toThrow(/não está ativo ou expirou/);

    // Novo QR para tentar carimbar o mesmo evento
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

    const event = await prisma.event.findFirst({
      where: { status: "ACTIVE" },
    });

    const admin = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
    });

    const attendant = await prisma.user.findFirst({
      where: { role: UserRole.ATTENDANT },
    });

    const existingStamp = await prisma.stamp.findFirst({
      where: {
        passport: { userId: user!.id },
        eventId: event!.id,
      },
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

    // Registro antigo CONTINUA no histórico
    const historyStamp = await prisma.stamp.findUnique({
      where: { id: existingStamp!.id },
    });

    expect(historyStamp).toBeTruthy();
    expect(historyStamp?.status).toBe(StampStatus.CANCELLED);

    // Novo carimbo agora é permitido com um novo QR
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

    const r1 = await checkRateLimit({
      key: testKey,
      limit,
      windowSeconds,
    });

    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await checkRateLimit({
      key: testKey,
      limit,
      windowSeconds,
    });

    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await checkRateLimit({
      key: testKey,
      limit,
      windowSeconds,
    });

    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    // 4ª chamada deve ser BLOQUEADA
    const r4 = await checkRateLimit({
      key: testKey,
      limit,
      windowSeconds,
    });

    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);

    const cleaned = await cleanupExpiredBuckets();

    expect(typeof cleaned).toBe("number");
  });

  it("9. Avaliação só é aceita após carimbo e uma vez por evento", async () => {
    const user = await prisma.user.findUnique({ where: { email: "participante1@empresa.com.br" } });
    const stamped = await prisma.stamp.findFirst({ where: { passport: { userId: user!.id }, status: "CONFIRMED" } });
    const otherEvent = await prisma.event.create({ data: {
      programId: (await prisma.passport.findUnique({ where: { userId: user!.id } }))!.programId,
      name: "Evento sem presença", startDate: new Date(), endDate: new Date(Date.now() + 3600000), status: "ACTIVE",
    } });
    await expect(createEventReview(user!.id, otherEvent.id, 8, "Bom")).rejects.toThrow(/após o carimbo/);
    const review = await createEventReview(user!.id, stamped!.eventId, 10, "  Excelente  ");
    expect(review.feedback).toBe("Excelente");
    await expect(createEventReview(user!.id, stamped!.eventId, 9, "Outra nota")).rejects.toMatchObject({ code: "P2002" });
  });

  it("10. Telefone duplicado é rejeitado no banco", async () => {
    const first = await prisma.user.create({ data: { email: "phone1@test.local", name: "Primeiro", phoneE164: "+5511987654324" } });
    expect(first.phoneE164).toBe("+5511987654324");
    await expect(prisma.user.create({ data: { email: "phone2@test.local", name: "Segundo", phoneE164: "+5511987654324" } })).rejects.toMatchObject({ code: "P2002" });
  });

  it("11. Recuperação troca a senha uma vez e encerra sessões", async () => {
    const user = await prisma.user.create({ data: {
      email: "recovery@test.local", name: "Recuperação", role: "PARTICIPANT", status: "ACTIVE", phoneE164: "+5511987654322",
    } });
    const account = await prisma.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: "old-hash" } });
    await prisma.session.create({ data: { userId: user.id, token: "recovery-test-session", expiresAt: new Date(Date.now() + 3600000) } });
    const url = await requestPasswordRecovery("11 98765-4322", "127.0.0.42", "http://localhost:3000");
    expect(url).toContain("/recuperar-senha/");
    const token = url!.split("/").at(-1)!;
    await expect(completePasswordRecovery(token, "nova-senha-123", "127.0.0.42")).resolves.toBe(true);
    expect((await prisma.account.findUnique({ where: { id: account.id } }))!.password).not.toBe("old-hash");
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    await expect(completePasswordRecovery(token, "nova-senha-456", "127.0.0.42")).rejects.toThrow(/inválido ou expirado/);
  });

  it("12. Cadastro por convite persiste WhatsApp no usuário", async () => {
    const program = await prisma.program.findUnique({ where: { slug: "passaporte-jrc-2026" } });
    const invitation = await prisma.invitation.create({ data: {
      programId: program!.id, tokenHash: `test-phone-invite-${Date.now()}`, status: "AVAILABLE", recipientPhoneE164: "+5511987654323",
    } });
    await prisma.pendingRegistration.create({ data: {
      programId: program!.id, invitationId: invitation.id, normalizedEmail: "phone-signup@test.local", name: "Cadastro Telefone",
      phoneE164: "+5511987654323", expiresAt: new Date(Date.now() + 300000), status: "VERIFIED",
    } });
    await expect(auth.api.signUpEmail({ body: {
      name: "Cadastro Telefone", email: "phone-signup@test.local", password: "senha-segura-123",
      phoneE164: "+5511987654323", realEstateAgency: "Imobiliária Teste",
    } })).rejects.toThrow();
    await withInvitationContext({ invitationId: invitation.id, email: "phone-signup@test.local", phoneE164: "+5511987654323" }, () => auth.api.signUpEmail({ body: {
      name: "Cadastro Telefone", email: "phone-signup@test.local", password: "senha-segura-123",
      phoneE164: "+5511987654323", realEstateAgency: "Imobiliária Teste",
    } }));
    const user = await prisma.user.findUnique({ where: { email: "phone-signup@test.local" } });
    expect(user?.phoneE164).toBe("+5511987654323");
  });

  it("13. Token adicional preserva o convite original", async () => {
    const program = await prisma.program.findUnique({ where: { slug: "passaporte-jrc-2026" } });
    const original = generateSecureToken(32);
    const invitation = await prisma.invitation.create({ data: { programId: program!.id, tokenHash: hashInvitationToken(original) } });
    const delivery = generateSecureToken(32);
    await prisma.invitationDeliveryToken.create({ data: { invitationId: invitation.id, tokenHash: hashInvitationToken(delivery) } });
    expect((await getInvitationByToken(original))?.id).toBe(invitation.id);
    expect((await getInvitationByToken(delivery))?.id).toBe(invitation.id);
  });

  it("14. Administrador prepara recuperação pelo WhatsApp usando telefone legado", async () => {
    const user = await prisma.user.create({ data: {
      email: "legacy-recovery@test.local", name: "Cliente Legado", role: "PARTICIPANT", status: "ACTIVE", phone: "(31) 98765-4321",
    } });
    const prepared = await prepareAdminPasswordRecovery(user.id, "https://passaporte.example.test");
    expect(prepared?.phoneE164).toBe("+5531987654321");
    expect(prepared?.url).toMatch(/^https:\/\/passaporte\.example\.test\/recuperar-senha\/[a-f0-9]{64}$/);
    expect(await prisma.passwordResetRequest.count({ where: { userId: user.id, consumedAt: null } })).toBe(1);
  });

  it("15. Convite com telefone legado inválido exige correção antes da ativação", async () => {
    const program = await prisma.program.findUnique({ where: { slug: "passaporte-jrc-2026" } });
    const token = generateSecureToken(32);
    const invitation = await prisma.invitation.create({ data: {
      programId: program!.id, tokenHash: hashInvitationToken(token), status: "AVAILABLE", phone: "número incompleto",
    } });
    const response = await registerInvitation(createRegisterRequest({
      token, name: "Cliente com Convite Legado", email: "legacy-invalid-phone@test.local",
      phone: "11987654329", password: "senha-segura-123", realEstateAgency: "Imobiliária Teste", lgpdConsent: true,
    }, "127.0.0.99"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/precisa ser corrigido pelo administrador/);
    expect((await prisma.invitation.findUnique({ where: { id: invitation.id } }))?.status).toBe("AVAILABLE");
    expect(await prisma.user.findUnique({ where: { email: "legacy-invalid-phone@test.local" } })).toBeNull();
  });
});
