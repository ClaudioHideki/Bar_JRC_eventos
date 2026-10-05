// Ordem dos setores da arte fornecida, no sentido horário a partir do topo.
export const WHEEL_AMOUNTS_CENTS = [300000, 400000, 500000, 100000, 200000] as const;

export type WheelSetting = { amountCents: number; weight: number; limit: number };
export type WheelAvailablePrize = WheelSetting & { awardedCount: number };

export function validateWheelSettings(settings: WheelSetting[], existing: Array<{ amountCents: number; awardedCount: number }>) {
  if (settings.length !== WHEEL_AMOUNTS_CENTS.length ||
      new Set(settings.map((item) => item.amountCents)).size !== WHEEL_AMOUNTS_CENTS.length ||
      settings.some((item) => !WHEEL_AMOUNTS_CENTS.includes(item.amountCents as typeof WHEEL_AMOUNTS_CENTS[number]))) {
    throw new Error("Configure exatamente os cinco prêmios exibidos na arte da roleta.");
  }
  for (const setting of settings) {
    if (!Number.isInteger(setting.weight) || setting.weight < 0 || setting.weight > 1000 ||
        !Number.isInteger(setting.limit) || setting.limit < 0 || setting.limit > 100000) {
      throw new Error("Informe chances de 0 a 1000 e limites de 0 a 100000.");
    }
    const awardedCount = existing.find((item) => item.amountCents === setting.amountCents)?.awardedCount || 0;
    if (setting.limit < awardedCount) {
      throw new Error(`O prêmio de R$ ${(setting.amountCents / 100).toLocaleString("pt-BR")} já foi sorteado ${awardedCount} vez(es).`);
    }
  }
  return settings;
}

export function selectWheelPrize<T extends WheelAvailablePrize>(prizes: T[], ticket: number): T | null {
  const available = prizes.filter((prize) => prize.weight > 0 && prize.awardedCount < prize.limit);
  const totalWeight = available.reduce((sum, prize) => sum + prize.weight, 0);
  if (totalWeight === 0) return null;
  if (!Number.isInteger(ticket) || ticket < 0 || ticket >= totalWeight) throw new Error("Sorteio inválido.");
  let remaining = ticket;
  for (const prize of available) {
    if (remaining < prize.weight) return prize;
    remaining -= prize.weight;
  }
  return null;
}
