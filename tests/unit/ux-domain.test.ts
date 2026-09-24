import { describe, expect, it } from "vitest";
import { normalizeBrazilianMobile } from "../../src/lib/security/phone";
import { validateEventReview } from "../../src/lib/domain/event-reviews";
import { buildCampaignMessage } from "../../src/lib/domain/campaign-message";
import { hashPasswordResetToken } from "../../src/lib/security/crypto";

describe("dados de contato", () => {
  it("normaliza telefone celular brasileiro para E.164", () => {
    expect(normalizeBrazilianMobile("(11) 98765-4321")).toBe("+5511987654321");
    expect(normalizeBrazilianMobile("+55 11 98765-4321")).toBe("+5511987654321");
  });

  it("rejeita telefone fixo ou número incompleto", () => {
    expect(() => normalizeBrazilianMobile("11 3456-7890")).toThrow();
    expect(() => normalizeBrazilianMobile("98765-4321")).toThrow();
  });
});

describe("comunicação da campanha", () => {
  it("envia acesso ao participante já cadastrado em vez de novo cadastro", () => {
    const message = buildCampaignMessage({ kind: "LOGIN", name: "Ana", url: "https://jrc.test/login" });
    expect(message.text).toContain("Olá, Ana!");
    expect(message.text).toContain("https://jrc.test/login");
    expect(message.text).not.toContain("Ative seu Passaporte");
    expect(message.text).toContain("setembro de 2027");
  });

  it("envia o link exclusivo de ativação ao convidado pendente", () => {
    const message = buildCampaignMessage({ kind: "INVITATION", name: "Beto", url: "https://jrc.test/convite/token" });
    expect(message.text).toContain("Ative seu Passaporte");
    expect(message.text).toContain("https://jrc.test/convite/token");
  });
});

describe("recuperação de acesso", () => {
  it("produz hash determinístico do token sem armazenar o segredo bruto", () => {
    const first = hashPasswordResetToken("token-de-teste");
    expect(first).toHaveLength(64);
    expect(first).toBe(hashPasswordResetToken("token-de-teste"));
    expect(first).not.toContain("token-de-teste");
  });
});

describe("avaliação de evento", () => {
  it("aceita nota inteira de 0 a 10 e feedback opcional", () => {
    expect(validateEventReview(0, "  Boa recepção  ")).toEqual({ rating: 0, feedback: "Boa recepção" });
    expect(validateEventReview(10, "")).toEqual({ rating: 10, feedback: null });
  });

  it("rejeita nota fracionada, fora da escala ou texto excessivo", () => {
    expect(() => validateEventReview(8.5, "")).toThrow();
    expect(() => validateEventReview(11, "")).toThrow();
    expect(() => validateEventReview(5, "x".repeat(2001))).toThrow();
  });
});
