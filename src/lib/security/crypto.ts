import crypto from "crypto";

export function getSecret(name: string, fallback?: string): string {
  const val = process.env[name] || fallback;
  if (!val) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return val;
}

export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function hashInvitationToken(token: string): string {
  const secret = getSecret(
    "INVITATION_TOKEN_SECRET",
    "default_invitation_secret_for_test_only_32_bytes"
  );

  return crypto
    .createHmac("sha256", secret)
    .update(token.trim())
    .digest("hex");
}

export function encryptInvitationToken(token: string): string {
  const secret = getSecret(
    "INVITATION_TOKEN_SECRET",
    "default_invitation_secret_for_test_only_32_bytes"
  );

  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(token.trim(), "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptInvitationToken(payload: string): string {
  const secret = getSecret(
    "INVITATION_TOKEN_SECRET",
    "default_invitation_secret_for_test_only_32_bytes"
  );

  const parts = payload.split(".");

  if (parts.length !== 3) {
    throw new Error("Token de convite criptografado invalido");
  }

  const [ivPart, authTagPart, encryptedPart] = parts;

  const key = crypto.createHash("sha256").update(secret).digest();

  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const encrypted = Buffer.from(encryptedPart, "base64url");

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function hashQrToken(token: string): string {
  const secret = getSecret(
    "QR_TOKEN_SECRET",
    "default_qr_token_secret_for_test_only_32_bytes"
  );

  return crypto
    .createHmac("sha256", secret)
    .update(token.trim())
    .digest("hex");
}

export function hashRateLimitKey(key: string): string {
  const secret = getSecret(
    "RATE_LIMIT_SECRET",
    "default_rate_limit_secret_for_test_only_32_bytes"
  );

  return crypto
    .createHmac("sha256", secret)
    .update(key.trim())
    .digest("hex");
}

export function hashIp(ip: string): string {
  const salt = getSecret(
    "RATE_LIMIT_SECRET",
    "default_rate_limit_secret_for_test_only_32_bytes"
  );

  return crypto
    .createHash("sha256")
    .update(`${ip}:${salt}`)
    .digest("hex")
    .slice(0, 32);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Previne CSV Formula Injection (DDE) prefixando apóstrofo se a célula
 * iniciar com '=', '+', '-', '@', '\t', ou '\r'.
 */
export function sanitizeCsvCell(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined) {
    return '""';
  }

  const str = String(value);

  const dangerousChars = [
    "=",
    "+",
    "-",
    "@",
    "\t",
    "\r",
  ];

  let sanitized = str;

  if (dangerousChars.some((char) => str.startsWith(char))) {
    sanitized = "'" + str;
  }

  return `"${sanitized.replace(/"/g, '""')}"`;
}

/**
 * Allowlist de campos para auditoria, eliminando tokens, senhas,
 * chaves e credenciais.
 */
const FORBIDDEN_METADATA_KEYS = new Set([
  "token",
  "tokenhash",
  "tokenencrypted",
  "otp",
  "code",
  "secret",
  "password",
  "cookie",
  "cookies",
  "authorization",
  "database_url",
  "database_test_url",
  "smtp_password",
  "key",
]);

export function redactSafeMetadata(
  data: unknown
): Record<string, unknown> | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(
    data as Record<string, unknown>
  )) {
    const lowerKey = key.toLowerCase();

    if (FORBIDDEN_METADATA_KEYS.has(lowerKey)) {
      result[key] = "[REDACTED]";
    } else if (
      typeof value === "object" &&
      value !== null
    ) {
      result[key] = redactSafeMetadata(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}