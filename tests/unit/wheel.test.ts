import { describe, expect, it } from "vitest";
import { WHEEL_AMOUNTS_CENTS, selectWheelPrize, validateWheelSettings } from "../../src/lib/domain/wheel";

describe("roleta do administrador", () => {
  it("usa os cinco setores da arte na ordem correta", () => {
    expect(WHEEL_AMOUNTS_CENTS).toEqual([300000, 400000, 500000, 100000, 200000]);
  });

  it("respeita pesos e exclui prêmio cujo limite foi alcançado", () => {
    const prizes = [
      { amountCents: 100000, weight: 100, limit: 1, awardedCount: 1 },
      { amountCents: 200000, weight: 2, limit: 2, awardedCount: 0 },
      { amountCents: 300000, weight: 1, limit: 2, awardedCount: 0 },
    ];
    expect(selectWheelPrize(prizes, 0)?.amountCents).toBe(200000);
    expect(selectWheelPrize(prizes, 1)?.amountCents).toBe(200000);
    expect(selectWheelPrize(prizes, 2)?.amountCents).toBe(300000);
  });

  it("impede reduzir o limite abaixo da quantidade já sorteada", () => {
    const settings = WHEEL_AMOUNTS_CENTS.map((amountCents) => ({ amountCents, weight: 1, limit: 1 }));
    expect(() => validateWheelSettings(settings, [{ amountCents: 300000, awardedCount: 2 }])).toThrow(/já foi sorteado/);
    expect(() => validateWheelSettings(settings, [])).not.toThrow();
  });
});
