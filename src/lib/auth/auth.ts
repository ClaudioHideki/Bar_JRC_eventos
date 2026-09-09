import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { prisma } from "../db/prisma";
import { sendEmailOtp } from "../email/sender";
import { normalizeEmail, getSecret, generateSecureToken } from "../security/crypto";
import { UserRole, UserStatus, PassportStatus } from "@prisma/client";

export const auth = betterAuth({
  secret: getSecret("BETTER_AUTH_SECRET", "default_better_auth_secret_must_be_32_chars_long"),
  baseURL: process.env.BETTER_AUTH_URL || process.env.APP_URL || "http://localhost:3000",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 4,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: UserRole.PARTICIPANT,
        input: false,
      },
      status: {
        type: "string",
        defaultValue: UserStatus.ACTIVE,
        input: false,
      },
      realEstateAgency: {
        type: "string",
        required: false,
        input: true,
      },
      birthDate: {
        type: "date",
        required: false,
        input: true,
      },
      lgpdConsent: {
        type: "boolean",
        defaultValue: false,
        input: true,
      },
      lgpdConsentAt: {
        type: "date",
        required: false,
        input: false,
      },
      lgpdConsentVersion: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const normalized = normalizeEmail(user.email);
          user.email = normalized;
          user.status = UserStatus.ACTIVE;
          if (!user.role) {
            user.role = UserRole.PARTICIPANT;
          }

          // REGRA INEGOCIÁVEL (AGENTS.md 1.5): Cadastro exclusivamente invite-only.
          // Qualquer cadastro de participante sem convite válido ativo associado deve falhar no nível mais baixo.
          if (user.role === UserRole.PARTICIPANT) {
            const pendingReg = await prisma.pendingRegistration.findFirst({
              where: {
                normalizedEmail: normalized,
                expiresAt: { gt: new Date() },
              },
            });
            if (!pendingReg) {
              throw new Error("Cadastro permitido exclusivamente mediante convite oficial válido.");
            }
          }

          if (user.lgpdConsent) {
            user.lgpdConsentAt = new Date();
            user.lgpdConsentVersion = "1.0-2026";
          }
        },
        after: async (user) => {
          // Cria automaticamente o Passaporte para o participante se ainda não possuir
          if (user.role === UserRole.PARTICIPANT) {
            const existing = await prisma.passport.findUnique({
              where: { userId: user.id },
            });
            if (!existing) {
              const program = await prisma.program.findFirst({
                where: { status: "ACTIVE" },
                orderBy: { createdAt: "desc" },
              });
              if (program) {
                const randomSuffix = generateSecureToken(2).toUpperCase();
                const passportNumber = `JRC-2026-${randomSuffix}`;
                await prisma.passport.create({
                  data: {
                    programId: program.id,
                    userId: user.id,
                    passportNumber,
                    status: PassportStatus.ACTIVE,
                  },
                });
              }
            }
          }
        },
      },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300, // 5 minutos
      sendVerificationOTP: async ({ email, otp, type }) => {
        const otpType = type === "sign-in" ? "LOGIN" : "INVITATION_ACTIVATION";
        await sendEmailOtp({ email, otp, type: otpType });
      },
    }),
  ],
});
