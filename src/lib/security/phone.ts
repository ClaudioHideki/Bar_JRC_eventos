export function normalizeBrazilianMobile(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  if (!/^[1-9][0-9]9[0-9]{8}$/.test(digits)) {
    throw new Error("Informe um celular brasileiro válido com DDD.");
  }
  return `+55${digits}`;
}

export function resolveStoredMobile(phoneE164: string | null | undefined, legacyPhone: string | null | undefined): string | null {
  for (const value of [phoneE164, legacyPhone]) {
    if (!value) continue;
    try {
      return normalizeBrazilianMobile(value);
    } catch {
      // Um número legado inválido permanece no banco para correção manual.
    }
  }
  return null;
}

export function hasLegacyPhoneMatch(
  targetE164: string,
  rows: Array<{ id: string; phone: string | null }>,
  excludedId?: string,
): boolean {
  return rows.some((row) => row.id !== excludedId && resolveStoredMobile(null, row.phone) === targetE164);
}
