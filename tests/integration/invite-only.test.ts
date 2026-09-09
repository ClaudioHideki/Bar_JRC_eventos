import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { auth } from "../../src/lib/auth/auth";
import { requestInvitationOtp } from "../../src/lib/domain/registration";

const testDbUrl = "postgresql://jrc_test_user:jrc_test_password@localhost:5433/jrc_passaporte_test?schema=public";
process.env.DATABASE_URL = testDbUrl;
process.env.INVITATION_TOKEN_SECRET = "test_invitation_secret_32_chars_minimum";
process.env.QR_TOKEN_SECRET = "test_qr_secret_32_chars_minimum_length";
process.env.RATE_LIMIT_SECRET = "test_rate_limit_secret_32_chars_minimum";
process.env.BETTER_AUTH_SECRET = "test_better_auth_secret_32_chars_minimum";

const prisma = new PrismaClient({
  datasources: { db: { url: testDbUrl } },
});

describe("Segurança de Cadastro: Exclusivamente Invite-Only", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("1. Chamada de cadastro por email/senha é desabilitada no Better Auth", async () => {
    const uninvitedEmail = "hacker_invasor@externo.com";

    // Tentativa direta de chamar a API interna do Better Auth para criar usuário por senha
    await expect(
      auth.api.signUpEmail({
        body: {
          email: uninvitedEmail,
          password: "password123456",
          name: "Invasor Sem Convite",
        },
      })
    ).rejects.toThrow(/Email and password sign up is not enabled/);

    const userInDb = await prisma.user.findUnique({
      where: { email: uninvitedEmail },
    });
    expect(userInDb).toBeNull();
  });

  it("2. Tentativa de cadastro sem convite válido é terminantemente recusada", async () => {
    const uninvitedEmail = "semconvite@empresa.com.br";

    // Token falso ou inexistente
    await expect(
      requestInvitationOtp({
        token: "fake-non-existent-token-1234567890",
        name: "Sem Convite",
        email: uninvitedEmail,
        ipAddress: "127.0.0.1",
      })
    ).rejects.toThrow(/Convite inválido ou inexistente/);

    const userInDb = await prisma.user.findUnique({
      where: { email: uninvitedEmail },
    });
    expect(userInDb).toBeNull();
  });
});
