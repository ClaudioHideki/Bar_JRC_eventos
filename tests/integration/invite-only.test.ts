import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { auth } from "../../src/lib/auth/auth";

const testDbUrl =
  "postgresql://jrc_test_user:jrc_test_password@localhost:5433/jrc_passaporte_test?schema=public";

process.env.DATABASE_URL = testDbUrl;
process.env.INVITATION_TOKEN_SECRET =
  "test_invitation_secret_32_chars_minimum";
process.env.QR_TOKEN_SECRET =
  "test_qr_secret_32_chars_minimum_length";
process.env.RATE_LIMIT_SECRET =
  "test_rate_limit_secret_32_chars_minimum";
process.env.BETTER_AUTH_SECRET =
  "test_better_auth_secret_32_chars_minimum";

const prisma = new PrismaClient({
  datasources: { db: { url: testDbUrl } },
});

describe("Segurança de Cadastro: Exclusivamente Invite-Only", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("1. Cadastro direto por email/senha sem convite válido é recusado", async () => {
    const uninvitedEmail = "hacker_invasor@externo.com";

    await expect(
      auth.api.signUpEmail({
        body: {
          email: uninvitedEmail,
          password: "password123456",
          name: "Invasor Sem Convite",
        },
      })
    ).rejects.toThrow();

    const userInDb = await prisma.user.findUnique({
      where: { email: uninvitedEmail },
    });

    expect(userInDb).toBeNull();
  });

  it("2. Outro cadastro direto sem convite válido também é recusado", async () => {
    const uninvitedEmail = "semconvite@empresa.com.br";

    await expect(
      auth.api.signUpEmail({
        body: {
          email: uninvitedEmail,
          password: "senha123456",
          name: "Sem Convite",
        },
      })
    ).rejects.toThrow();

    const userInDb = await prisma.user.findUnique({
      where: { email: uninvitedEmail },
    });

    expect(userInDb).toBeNull();
  });
});