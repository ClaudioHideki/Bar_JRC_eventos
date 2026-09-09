import { describe, it, expect } from "vitest";
import {
  generateSecureToken,
  hashInvitationToken,
  hashQrToken,
  normalizeEmail,
  timingSafeEqual,
  sanitizeCsvCell,
  redactSafeMetadata,
} from "../../src/lib/security/crypto";

describe("Crypto and Security Utils", () => {
  it("deve gerar token criptograficamente seguro com pelo menos 256 bits", () => {
    const token = generateSecureToken(32);
    expect(token).toBeTypeOf("string");
    expect(token.length).toBe(64); // 32 bytes em hex = 64 chars
  });

  it("deve gerar hashes HMAC determinísticos e seguros", () => {
    const token = "my-secret-test-token-123";
    const hash1 = hashInvitationToken(token);
    const hash2 = hashInvitationToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("deve isolar segredos de convite e de QR Code", () => {
    process.env.INVITATION_TOKEN_SECRET = "secret_invitation_aaaaaaaaaaaaaaaaa";
    process.env.QR_TOKEN_SECRET = "secret_qr_bbbbbbbbbbbbbbbbbbbbbbbbbb";
    const token = "common-token";
    const inviteHash = hashInvitationToken(token);
    const qrHash = hashQrToken(token);
    expect(inviteHash).not.toBe(qrHash);
  });

  it("deve normalizar e-mail corretamente removendo espaços e convertendo para minúsculas", () => {
    expect(normalizeEmail("  Usuario.JRC@Empresa.COM.br ")).toBe("usuario.jrc@empresa.com.br");
  });

  it("deve realizar comparação segura em tempo constante (timingSafeEqual)", () => {
    const a = "hash1234567890abcdef";
    const b = "hash1234567890abcdef";
    const c = "hash1234567890abcdeg";
    expect(timingSafeEqual(a, b)).toBe(true);
    expect(timingSafeEqual(a, c)).toBe(false);
    expect(timingSafeEqual(a, "curto")).toBe(false);
  });

  it("deve sanitizar células contra CSV Formula Injection (DDE)", () => {
    expect(sanitizeCsvCell("=1+1")).toBe("\"'=1+1\"");
    expect(sanitizeCsvCell("+cmd|' /C calc'!A0")).toBe("\"'+cmd|' /C calc'!A0\"");
    expect(sanitizeCsvCell("-2+3")).toBe("\"'-2+3\"");
    expect(sanitizeCsvCell("@SUM(A1:A10)")).toBe("\"'@SUM(A1:A10)\"");
    expect(sanitizeCsvCell("\tTAB_INJECTION")).toBe("\"'\tTAB_INJECTION\"");
    expect(sanitizeCsvCell("\rRETURN_INJECTION")).toBe("\"'\rRETURN_INJECTION\"");
    expect(sanitizeCsvCell("Texto Seguro")).toBe("\"Texto Seguro\"");
    expect(sanitizeCsvCell('Nome com "aspas"')).toBe('"Nome com ""aspas"""');
    expect(sanitizeCsvCell(null)).toBe('""');
  });

  it("deve redigir dados sensíveis e tokens em safeMetadata de auditoria", () => {
    const input = {
      event: "login",
      token: "secret_raw_token_xyz",
      password: "my_plain_password",
      nested: {
        otp: "123456",
        safeField: "safeValue",
      },
    };

    const redacted = redactSafeMetadata(input);
    expect(redacted).toEqual({
      event: "login",
      token: "[REDACTED]",
      password: "[REDACTED]",
      nested: {
        otp: "[REDACTED]",
        safeField: "safeValue",
      },
    });
  });
});
