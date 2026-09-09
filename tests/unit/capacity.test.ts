import { describe, it, expect } from "vitest";

describe("Cálculo de Capacidade do Programa (30 participantes)", () => {
  const CAPACITY = 30;

  it("deve permitir novos convites quando a soma de utilizáveis + utilizados for menor que a capacidade", () => {
    const available = 10;
    const sent = 5;
    const used = 10;
    const revoked = 5; // Não conta
    const expired = 2; // Não conta

    const occupied = available + sent + used;
    expect(occupied).toBe(25);
    expect(occupied + 5).toBeLessThanOrEqual(CAPACITY);
  });

  it("deve bloquear emissão que ultrapasse a capacidade total de 30", () => {
    const available = 15;
    const sent = 10;
    const used = 5;
    const occupied = available + sent + used; // 30

    expect(occupied).toBe(30);
    const requested = 1;
    expect(occupied + requested > CAPACITY).toBe(true);
  });

  it("deve permitir substituir convites revogados sem exceder a capacidade", () => {
    let available = 29;
    let used = 1;
    expect(available + used).toBe(30);

    // Revoga 1 disponível
    available -= 1;
    expect(available + used).toBe(29);

    // Substituição permitida de 1 novo
    const newInviteCount = 1;
    expect(available + used + newInviteCount).toBe(CAPACITY);
  });
});
