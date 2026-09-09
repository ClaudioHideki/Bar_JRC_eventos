"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface InvitationItem {
  id: string;
  status: string;
  claimedName: string | null;
  claimedEmail: string | null;
  usedByName: string | null;
  usedByEmail: string | null;
  usedAt: string | null;
  createdAt: string;
}

export function AdminConvitesClient({
  programCapacity,
  initialInvitations,
}: {
  programCapacity: number;
  initialInvitations: InvitationItem[];
}) {
  const router = useRouter();
  const [invitations, setInvitations] = useState<InvitationItem[]>(initialInvitations);
  
  useEffect(() => {
    setInvitations(initialInvitations);
  }, [initialInvitations]);

  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedTokens, setGeneratedTokens] = useState<
    Array<{ id: string; inviteLink: string; name?: string; email?: string; phone?: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Formulário de Convite Individual
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  const activeCount = invitations.filter((i) =>
    ["AVAILABLE", "SENT", "USED"].includes(i.status)
  ).length;

  const handleSendSingleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          recipientName: clientName,
          recipientEmail: clientEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao criar convite.");
      }

      setGeneratedTokens([
        {
          id: data.id,
          inviteLink: data.inviteLink,
          name: data.claimedName,
          email: data.claimedEmail,
          phone: clientPhone,
        },
        ...generatedTokens,
      ]);

      setSuccess(
        data.emailSent
          ? `Convite gerado e enviado por e-mail para ${data.claimedEmail}!`
          : `Convite gerado para ${clientName || "o cliente"}! Copie o link abaixo, abra diretamente ou compartilhe via WhatsApp.`
      );

      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setShowInviteForm(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao criar convite.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBatch = async (count: number) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ count }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao gerar convites.");
      }

      setGeneratedTokens(data);
      setSuccess(`Lote de ${data.length} convite(s) gerado com sucesso!`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao gerar convites.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePermanent = async (invitationId: string, isUsed?: boolean) => {
    const confirmMessage = isUsed
      ? "Atenção: Este convite já foi utilizado por um participante. Tem certeza que deseja excluí-lo? O registro do convite será apagado e a vaga liberada."
      : "Deseja excluir definitivamente este convite do banco de dados?";
    if (!confirm(confirmMessage)) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/invitations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ invitationId, permanentDelete: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao excluir convite.");
      }

      setSuccess("Convite excluído com sucesso!");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao excluir.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearUnused = async () => {
    if (!confirm("Tem certeza que deseja apagar TODOS os convites não utilizados da lista?")) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/invitations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clearUnused: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao limpar convites.");
      }

      setSuccess(data.message || "Convites não utilizados excluídos!");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao limpar.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Convites Oficiais</h1>
          <p className="text-sm text-muted">
            Total: <span className="font-bold text-foreground">{activeCount}</span> convites gerados • <span className="text-success font-semibold">Emissão Ilimitada</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="rounded-xl bg-gradient-to-r from-primary to-secondary px-4 py-2 text-xs font-bold text-white shadow hover:opacity-95 transition"
          >
            {showInviteForm ? "Fechar Formulário" : "✉️ Convidar Cliente por Link / E-mail"}
          </button>

          <button
            onClick={() => handleGenerateBatch(10)}
            disabled={loading}
            className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition disabled:opacity-50"
            title="Gerar lote de 10 convites livres"
          >
            +10 Livres
          </button>

          <button
            onClick={() => handleGenerateBatch(25)}
            disabled={loading}
            className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition disabled:opacity-50"
            title="Gerar lote de 25 convites livres"
          >
            +25 Livres
          </button>

          <button
            onClick={handleClearUnused}
            disabled={loading}
            className="rounded-xl border border-danger/30 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10 transition disabled:opacity-50"
          >
            Limpar Livres
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="rounded-xl border border-secondary/30 bg-secondary/10 p-3 text-sm text-secondary">
          {success}
        </div>
      )}

      {/* Formulário para Convidar Cliente Específico */}
      {showInviteForm && (
        <form onSubmit={handleSendSingleInvite} className="rounded-2xl border border-primary/30 bg-surface p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-premium">
            Enviar Convite Oficial Para o Cliente
          </h3>
          <p className="text-xs text-muted">
            Gera o link de ativação individual para o cliente acessar o Passaporte JRC. Você pode enviar pelo WhatsApp ou por e-mail.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                Nome do Cliente / Corretor *
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                WhatsApp do Cliente (Opcional)
              </label>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="Ex: 11999998888"
                className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                E-mail do Cliente (Opcional)
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="cliente@imobiliaria.com.br"
                className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition disabled:opacity-50"
          >
            {loading ? "Gerando Convite..." : "Gerar Link de Convite"}
          </button>
        </form>
      )}

      {/* Exibição dos Tokens Recém-Gerados com Links Copiáveis e WhatsApp */}
      {generatedTokens.length > 0 && (
        <div className="rounded-2xl border border-secondary/40 bg-surface p-5 shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-secondary">
            Links Oficiais de Convite Gerados
          </h3>
          <p className="text-xs text-muted">
            Envie este link direto para o cliente ativar o seu passaporte:
          </p>
          <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
            {generatedTokens.map((item) => {
              // No WhatsApp, URLs com 'localhost' não são clicáveis pelo app. Convertemos para 127.0.0.1 em ambiente local para o WhatsApp torná-lo clicável!
              const clickableLink = item.inviteLink.includes("localhost")
                ? item.inviteLink.replace("localhost", "127.0.0.1")
                : item.inviteLink;

              const cleanPhone = item.phone ? item.phone.replace(/\D/g, "") : "";
              const phoneParam = cleanPhone
                ? `phone=${cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`}&`
                : "";

              const whatsappUrl = `https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(
                `🍻 *Convite Exclusivo — Passaporte Bar JRC (40 Anos)*\n\nOlá${item.name ? `, *${item.name}*` : ""}! Você recebeu um convite oficial para participar dos encontros mensais do Bar JRC.\n\nComplete os 12 carimbos mensais e garanta o direito de escolher a temática do evento de encerramento em Dezembro!\n\n👉 *Ative seu Passaporte Digital no link abaixo:*\n${clickableLink}`
              )}`;

              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl bg-background p-3 text-xs border border-muted/20 gap-2"
                >
                  <div className="min-w-0 flex-1">
                    {item.name && <p className="font-bold text-foreground">{item.name}</p>}
                    <span className="font-mono text-muted/80 truncate block text-[11px]">
                      {item.inviteLink}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={item.inviteLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 font-semibold hover:bg-blue-500/30 transition text-xs flex items-center gap-1"
                      title="Abrir página de cadastro do convite em uma nova aba"
                    >
                      <span>🔗</span> Abrir Convite
                    </a>
                    <button
                      onClick={() => copyToClipboard(item.inviteLink, item.id)}
                      className="rounded-lg bg-primary/20 px-3 py-1 font-semibold text-primary hover:bg-primary/30 transition text-xs"
                    >
                      {copiedId === item.id ? "Copiado!" : "Copiar Link"}
                    </button>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 font-semibold hover:bg-emerald-500/30 transition text-xs flex items-center gap-1"
                    >
                      <span>💬</span> WhatsApp
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabela de Convites */}
      <div className="overflow-hidden rounded-2xl border border-primary/20 bg-surface shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-muted/20 bg-background/50 text-muted uppercase text-[10px] font-bold">
              <tr>
                <th className="p-4">Status</th>
                <th className="p-4">Destinatário Marcado</th>
                <th className="p-4">Utilizado Por</th>
                <th className="p-4">Data Utilização</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/10">
              {invitations.map((inv) => {
                const isUsed = inv.status === "USED";
                const isRevoked = inv.status === "REVOKED";

                return (
                  <tr key={inv.id} className="hover:bg-white/5 transition">
                    <td className="p-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                          isUsed
                            ? "bg-success/10 text-success border-success/30"
                            : isRevoked
                              ? "bg-danger/10 text-danger border-danger/30"
                              : inv.status === "SENT"
                                ? "bg-secondary/10 text-secondary border-secondary/30"
                                : "bg-primary/10 text-primary border-primary/30"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-foreground">
                      {inv.claimedName || inv.claimedEmail ? (
                        <div>
                          <p>{inv.claimedName || "—"}</p>
                          <p className="text-[10px] text-muted">{inv.claimedEmail || ""}</p>
                        </div>
                      ) : (
                        <span className="text-muted/40">Livre</span>
                      )}
                    </td>
                    <td className="p-4 text-foreground">
                      {inv.usedByName ? (
                        <div>
                          <p className="font-semibold text-success">{inv.usedByName}</p>
                          <p className="text-[10px] text-muted">{inv.usedByEmail}</p>
                        </div>
                      ) : (
                        <span className="text-muted/40">—</span>
                      )}
                    </td>
                    <td className="p-4 text-muted">
                      {inv.usedAt
                        ? new Date(inv.usedAt).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDeletePermanent(inv.id, isUsed)}
                        disabled={loading}
                        className="rounded-lg border border-danger/30 px-2.5 py-1 text-[11px] font-semibold text-danger hover:bg-danger/10 transition cursor-pointer"
                        title="Excluir convite permanentemente"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
