import { resolveStoredMobile } from "../security/phone";

export function matchingRegisteredRecipients<T extends { phoneE164: string | null; phone: string | null }>(phoneE164: string, users: T[]): T[] {
  return users.filter((user) => resolveStoredMobile(user.phoneE164, user.phone) === phoneE164);
}

export function campaignKindForStatus(status: string): "LOGIN" | "INVITATION" | null {
  if (status === "USED") return "LOGIN";
  if (status === "AVAILABLE" || status === "SENT" || status === "EXPIRED") return "INVITATION";
  return null;
}

export function buildCampaignMessage(input: { kind: "LOGIN" | "INVITATION"; name: string; url: string }) {
  const name = input.name.trim() || "participante";
  const header = "🎟️ Passaporte Bar JRC — 40 Anos";
  const common = "Complete os 12 carimbos mensais e conquiste o direito de escolher a temática do evento de encerramento, em setembro de 2027!\n\nImportante: caso ninguém complete os 12 carimbos, será válido o participante que tiver a maior quantidade de carimbos.";
  const text = input.kind === "LOGIN"
    ? `${header}\n\nOlá, ${name}! Seu Passaporte Digital está pronto para receber o carimbo de hoje!\n\nPara validar sua participação, faça login no seu Passaporte Digital e procure o atendente mais próximo do evento para validar seu carimbo.\n\n${common}\n\n🔗 Acesse seu Passaporte Digital:\n${input.url}`
    : `${header}\n\nOlá, ${name}! Você recebeu um convite oficial para o Passaporte Digital do Bar JRC.\n\n${common}\n\n🔗 Ative seu Passaporte Digital:\n${input.url}`;
  const escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const html = `<div style="font-family:Arial,sans-serif;background:#071725;color:#f7f8fa;padding:24px;border-radius:12px"><p style="color:#ed3228;font-weight:700;white-space:pre-line">${escaped.replaceAll("\n", "<br>")}</p></div>`;
  return { subject: input.kind === "LOGIN" ? "Acesse seu Passaporte Bar JRC" : "Ative seu Passaporte Bar JRC", text, html };
}
