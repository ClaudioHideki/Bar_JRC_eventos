"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface InvitationItem {
  id: string;
  status: string;
  claimedName: string | null;
  claimedEmail: string | null;
  phone: string | null;
  inviteLink: string | null;
  usedByName: string | null;
  usedByEmail: string | null;
  usedAt: string | null;
  createdAt: string;
}

interface GeneratedToken {
  id: string;
  inviteLink: string;
  name?: string;
  email?: string;
  phone?: string;
}

export function AdminConvitesClient({
  programCapacity,
  initialInvitations,
}: {
  programCapacity: number;
  initialInvitations: InvitationItem[];
}) {
  const router = useRouter();

  const [invitations, setInvitations] =
    useState<InvitationItem[]>(initialInvitations);

  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedTokens, setGeneratedTokens] = useState<
    GeneratedToken[]
  >([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Novo convite
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  // Edição
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");

  useEffect(() => {
    setInvitations(initialInvitations);
  }, [initialInvitations]);

  const activeCount = invitations.filter((i) =>
    ["AVAILABLE", "SENT", "USED"].includes(i.status)
  ).length;

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleSendSingleInvite = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setLoading(true);
    clearMessages();

    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          recipientName: clientName,
          recipientEmail: clientEmail,
          phone: clientPhone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Erro ao criar convite."
        );
      }

      setGeneratedTokens((current) => [
        {
          id: data.id,
          inviteLink: data.inviteLink,
          name: data.claimedName || undefined,
          email: data.claimedEmail || undefined,
          phone: data.phone || undefined,
        },
        ...current,
      ]);

      setSuccess(
        data.emailSent
          ? `Convite gerado e enviado por e-mail para ${data.claimedEmail}!`
          : `Convite gerado para ${
              clientName || "o cliente"
            }! O link já está disponível para copiar ou compartilhar.`
      );

      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setShowInviteForm(false);

      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao criar convite."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBatch = async (count: number) => {
    setLoading(true);
    clearMessages();

    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          count,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Erro ao gerar convites."
        );
      }

      const generated: GeneratedToken[] = data.map(
        (item: {
          id: string;
          inviteLink: string;
        }) => ({
          id: item.id,
          inviteLink: item.inviteLink,
        })
      );

      setGeneratedTokens(generated);

      setSuccess(
        `Lote de ${generated.length} convite(s) gerado com sucesso!`
      );

      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao gerar convites."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePermanent = async (
    invitationId: string,
    isUsed?: boolean
  ) => {
    const confirmMessage = isUsed
      ? "Atenção: este convite já foi utilizado por um participante. Tem certeza que deseja excluí-lo? O registro do convite será apagado."
      : "Deseja excluir definitivamente este convite do banco de dados?";

    if (!confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    clearMessages();

    try {
      const res = await fetch("/api/admin/invitations", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          invitationId,
          permanentDelete: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Erro ao excluir convite."
        );
      }

      setInvitations((current) =>
        current.filter(
          (invitation) =>
            invitation.id !== invitationId
        )
      );

      setGeneratedTokens((current) =>
        current.filter(
          (invitation) =>
            invitation.id !== invitationId
        )
      );

      setSuccess("Convite excluído com sucesso!");

      if (editingId === invitationId) {
        cancelEdit();
      }

      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao excluir convite."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClearUnused = async () => {
    if (
      !confirm(
        "Tem certeza que deseja apagar TODOS os convites não utilizados da lista?"
      )
    ) {
      return;
    }

    setLoading(true);
    clearMessages();

    try {
      const res = await fetch("/api/admin/invitations", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          clearUnused: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Erro ao limpar convites."
        );
      }

      setSuccess(
        data.message ||
          "Convites não utilizados excluídos!"
      );

      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao limpar convites."
      );
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (invitation: InvitationItem) => {
    if (invitation.status === "USED") {
      setError(
        "Este convite já foi utilizado. Os dados do destinatário não podem mais ser alterados."
      );
      return;
    }

    clearMessages();

    setEditingId(invitation.id);
    setEditName(invitation.claimedName || "");
    setEditEmail(invitation.claimedEmail || "");
    setEditPhone(invitation.phone || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditEmail("");
    setEditPhone("");
  };

  const handleSaveEdit = async (
    invitationId: string
  ) => {
    setLoading(true);
    clearMessages();

    try {
      const res = await fetch("/api/admin/invitations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          invitationId,
          recipientName: editName,
          recipientEmail: editEmail,
          recipientPhone: editPhone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Erro ao editar convite."
        );
      }

      setInvitations((current) =>
        current.map((invitation) =>
          invitation.id === invitationId
            ? {
                ...invitation,
                status: data.status,
                claimedName:
                  data.claimedName || null,
                claimedEmail:
                  data.claimedEmail || null,
                phone: data.phone || null,
                inviteLink:
                  data.inviteLink ||
                  invitation.inviteLink,
              }
            : invitation
        )
      );

      setGeneratedTokens((current) =>
        current.map((invitation) =>
          invitation.id === invitationId
            ? {
                ...invitation,
                name: data.claimedName || undefined,
                email:
                  data.claimedEmail || undefined,
                phone: data.phone || undefined,
                inviteLink:
                  data.inviteLink ||
                  invitation.inviteLink,
              }
            : invitation
        )
      );

      cancelEdit();

      setSuccess(
        "Convite atualizado. O link original foi mantido."
      );

      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao editar convite."
      );
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (
    link: string,
    id: string
  ) => {
    try {
      await navigator.clipboard.writeText(link);

      setCopiedId(id);

      setTimeout(() => {
        setCopiedId(null);
      }, 2500);
    } catch {
      setError(
        "Não foi possível copiar o link automaticamente."
      );
    }
  };

  const buildWhatsappUrl = (
    link: string,
    name?: string | null,
    phone?: string | null
  ) => {
    const clickableLink = link.includes("localhost")
      ? link.replace("localhost", "127.0.0.1")
      : link;

    const cleanPhone = phone
      ? phone.replace(/\D/g, "")
      : "";

    const normalizedPhone = cleanPhone
      ? cleanPhone.startsWith("55")
        ? cleanPhone
        : `55${cleanPhone}`
      : "";

    const phoneParam = normalizedPhone
      ? `phone=${normalizedPhone}&`
      : "";

    const message = `🍻 *Convite Exclusivo — Passaporte Bar JRC (40 Anos)*

Olá${name ? `, *${name}*` : ""}! Você recebeu o passaporte oficial, participe das campanhas comerciais, e garanta seus vistos no nosso passaporte.

Complete os 12 carimbos mensais e garanta o direito de escolher a temática do evento de encerramento em Setembro de 2027!

Obs.: Caso ninguém atinja os 12 selos, será válido quem tiver a maior quantidade de carimbos.

👉 *Ative seu Passaporte Digital no link abaixo:*
${clickableLink}`;

    return `https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(
      message
    )}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Gestão de Convites Oficiais
          </h1>

          <p className="text-sm text-muted">
            Total:{" "}
            <span className="font-bold text-foreground">
              {activeCount}
            </span>{" "}
            convites gerados
            {programCapacity > 0 && (
              <>
                {" "}
                •{" "}
                <span className="font-semibold text-success">
                  Emissão Ilimitada
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              setShowInviteForm(
                (current) => !current
              )
            }
            className="rounded-xl bg-gradient-to-r from-primary to-secondary px-4 py-2 text-xs font-bold text-white shadow transition hover:opacity-95"
          >
            {showInviteForm
              ? "Fechar Formulário"
              : "Convidar Cliente por Link / E-mail"}
          </button>

          <button
            onClick={() => handleGenerateBatch(10)}
            disabled={loading}
            className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/20 disabled:opacity-50"
          >
            +10 Livres
          </button>

          <button
            onClick={() => handleGenerateBatch(25)}
            disabled={loading}
            className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/20 disabled:opacity-50"
          >
            +25 Livres
          </button>

          <button
            onClick={handleClearUnused}
            disabled={loading}
            className="rounded-xl border border-danger/30 px-3 py-2 text-xs font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-50"
          >
            Limpar Livres
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-secondary/30 bg-secondary/10 p-3 text-sm text-secondary"
        >
          {success}
        </div>
      )}

      {showInviteForm && (
        <form
          onSubmit={handleSendSingleInvite}
          className="space-y-4 rounded-2xl border border-primary/30 bg-surface p-6 shadow-xl"
        >
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-premium">
              Gerar Convite Oficial
            </h3>

            <p className="mt-1 text-xs text-muted">
              Crie o convite e compartilhe o link pelo
              WhatsApp ou por e-mail.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                Nome do Cliente / Corretor *
              </label>

              <input
                type="text"
                required
                value={clientName}
                onChange={(e) =>
                  setClientName(e.target.value)
                }
                placeholder="Ex: João da Silva"
                className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                WhatsApp do Cliente
              </label>

              <input
                type="tel"
                value={clientPhone}
                onChange={(e) =>
                  setClientPhone(e.target.value)
                }
                placeholder="Ex: 11999998888"
                className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                E-mail do Cliente
              </label>

              <input
                type="email"
                value={clientEmail}
                onChange={(e) =>
                  setClientEmail(e.target.value)
                }
                placeholder="cliente@imobiliaria.com.br"
                className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-primary/90 disabled:opacity-50"
          >
            {loading
              ? "Gerando Convite..."
              : "Gerar Link de Convite"}
          </button>
        </form>
      )}

      {generatedTokens.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-secondary/40 bg-surface p-5 shadow-xl">
          <h3 className="text-sm font-bold text-secondary">
            Links Oficiais de Convite Gerados
          </h3>

          <p className="text-xs text-muted">
            Os links também ficam salvos na tabela de
            convites abaixo.
          </p>

          <div className="max-h-60 space-y-2 overflow-y-auto pr-2">
            {generatedTokens.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-2 rounded-xl border border-muted/20 bg-background p-3 text-xs sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  {item.name && (
                    <p className="font-bold text-foreground">
                      {item.name}
                    </p>
                  )}

                  <span className="block truncate font-mono text-[11px] text-muted/80">
                    {item.inviteLink}
                  </span>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <a
                    href={item.inviteLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20"
                  >
                    Abrir Convite
                  </a>

                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        item.inviteLink,
                        item.id
                      )
                    }
                    className="rounded-lg bg-primary/20 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/30"
                  >
                    {copiedId === item.id
                      ? "Copiado!"
                      : "Copiar Link"}
                  </button>

                  <a
                    href={buildWhatsappUrl(
                      item.inviteLink,
                      item.name,
                      item.phone
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success transition hover:bg-success/20"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-primary/20 bg-surface shadow-lg">
        <div className="border-b border-muted/20 p-4">
          <h2 className="font-bold text-foreground">
            Todos os Convites
          </h2>

          <p className="mt-1 text-xs text-muted">
            Consulte, edite e reutilize o link de cada
            convite criado.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-muted/20 bg-background/50 text-[10px] font-bold uppercase text-muted">
              <tr>
                <th className="p-4">Status</th>
                <th className="p-4">Destinatário</th>
                <th className="p-4">Telefone</th>
                <th className="p-4">Utilizado Por</th>
                <th className="p-4">Data Utilização</th>
                <th className="p-4">Link</th>
                <th className="p-4 text-right">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-muted/10">
              {invitations.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-muted"
                  >
                    Nenhum convite criado.
                  </td>
                </tr>
              )}

              {invitations.map((inv) => {
                const isUsed =
                  inv.status === "USED";

                const isRevoked =
                  inv.status === "REVOKED";

                const isEditing =
                  editingId === inv.id;

                return (
                  <tr
                    key={inv.id}
                    className="align-top transition hover:bg-white/5"
                  >
                    <td className="p-4">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                          isUsed
                            ? "border-success/30 bg-success/10 text-success"
                            : isRevoked
                              ? "border-danger/30 bg-danger/10 text-danger"
                              : inv.status ===
                                  "SENT"
                                ? "border-secondary/30 bg-secondary/10 text-secondary"
                                : "border-primary/30 bg-primary/10 text-primary"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>

                    <td className="p-4 font-medium text-foreground">
                      {isEditing ? (
                        <div className="min-w-[220px] space-y-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) =>
                              setEditName(
                                e.target.value
                              )
                            }
                            placeholder="Nome"
                            className="h-9 w-full rounded-lg border border-muted/30 bg-background px-2 text-xs text-foreground focus:border-primary focus:outline-none"
                          />

                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) =>
                              setEditEmail(
                                e.target.value
                              )
                            }
                            placeholder="E-mail"
                            className="h-9 w-full rounded-lg border border-muted/30 bg-background px-2 text-xs text-foreground focus:border-primary focus:outline-none"
                          />
                        </div>
                      ) : inv.claimedName ||
                        inv.claimedEmail ? (
                        <div>
                          <p>
                            {inv.claimedName || "—"}
                          </p>

                          <p className="text-[10px] text-muted">
                            {inv.claimedEmail || ""}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted/40">
                          Livre
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-foreground">
                      {isEditing ? (
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={(e) =>
                            setEditPhone(
                              e.target.value
                            )
                          }
                          placeholder="11999998888"
                          className="h-9 min-w-[150px] rounded-lg border border-muted/30 bg-background px-2 text-xs text-foreground focus:border-primary focus:outline-none"
                        />
                      ) : (
                        inv.phone || (
                          <span className="text-muted/40">
                            —
                          </span>
                        )
                      )}
                    </td>

                    <td className="p-4 text-foreground">
                      {inv.usedByName ? (
                        <div>
                          <p className="font-semibold text-success">
                            {inv.usedByName}
                          </p>

                          <p className="text-[10px] text-muted">
                            {inv.usedByEmail}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted/40">
                          —
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-muted">
                      {inv.usedAt
                        ? new Date(
                            inv.usedAt
                          ).toLocaleString(
                            "pt-BR",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "—"}
                    </td>

                    <td className="p-4">
                      {inv.inviteLink ? (
                        <span
                          className="block max-w-[180px] truncate font-mono text-[10px] text-muted"
                          title={inv.inviteLink}
                        >
                          {inv.inviteLink}
                        </span>
                      ) : (
                        <span
                          className="text-[10px] text-muted/50"
                          title="Este convite foi criado antes do armazenamento seguro dos links."
                        >
                          Link antigo indisponível
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="flex min-w-[300px] flex-wrap justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                handleSaveEdit(
                                  inv.id
                                )
                              }
                              disabled={loading}
                              className="rounded-lg border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success transition hover:bg-success/20 disabled:opacity-50"
                            >
                              Salvar
                            </button>

                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={loading}
                              className="rounded-lg border border-muted/30 px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-muted/10 disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                startEdit(inv)
                              }
                              disabled={
                                loading || isUsed
                              }
                              title={
                                isUsed
                                  ? "Convite já utilizado"
                                  : "Editar nome, e-mail e telefone"
                              }
                              className="rounded-lg border border-secondary/30 bg-secondary/10 px-2.5 py-1 text-[11px] font-semibold text-secondary transition hover:bg-secondary/20 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Editar
                            </button>

                            {inv.inviteLink && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyToClipboard(
                                      inv.inviteLink!,
                                      inv.id
                                    )
                                  }
                                  className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/20"
                                >
                                  {copiedId ===
                                  inv.id
                                    ? "Copiado!"
                                    : "Copiar Link"}
                                </button>

                                <a
                                  href={
                                    inv.inviteLink
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-lg border border-primary/30 px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/10"
                                >
                                  Abrir Convite
                                </a>

                                <a
                                  href={buildWhatsappUrl(
                                    inv.inviteLink,
                                    inv.claimedName,
                                    inv.phone
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-lg border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success transition hover:bg-success/20"
                                >
                                  WhatsApp
                                </a>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                handleDeletePermanent(
                                  inv.id,
                                  isUsed
                                )
                              }
                              disabled={loading}
                              className="rounded-lg border border-danger/30 px-2.5 py-1 text-[11px] font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-50"
                            >
                              Excluir
                            </button>
                          </>
                        )}
                      </div>
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