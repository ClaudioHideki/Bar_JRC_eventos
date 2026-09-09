"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface StampItem {
  id: string;
  participantName: string;
  participantEmail: string;
  passportNumber: string;
  eventName: string;
  attendantName: string;
  status: string;
  stampedAt: string;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancellationReason: string | null;
}

interface EventOption {
  id: string;
  name: string;
}

interface PassportOption {
  id: string;
  passportNumber: string;
  participantName: string;
}

export function AdminCarimbosClient({
  initialStamps,
  activeEvents,
  activePassports,
}: {
  initialStamps: StampItem[];
  activeEvents: EventOption[];
  activePassports: PassportOption[];
}) {
  const router = useRouter();
  const [stamps, setStamps] = useState<StampItem[]>(initialStamps);

  useEffect(() => {
    setStamps(initialStamps);
  }, [initialStamps]);

  const [loading, setLoading] = useState(false);
  const [cancellingStampId, setCancellingStampId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedPassportId, setSelectedPassportId] = useState(activePassports[0]?.id || "");
  const [selectedEventId, setSelectedEventId] = useState(activeEvents[0]?.id || "");
  const [manualJustification, setManualJustification] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCancelStamp = async () => {
    if (!cancellingStampId || !cancellationReason.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/stamps/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          stampId: cancellingStampId,
          reason: cancellationReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao cancelar carimbo.");
      }

      setSuccess("Carimbo cancelado de forma justificada com sucesso.");
      setCancellingStampId(null);
      setCancellationReason("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao cancelar carimbo.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStampPermanent = async (stamp: StampItem) => {
    const confirmed = confirm(
      `Deseja excluir permanentemente o registro de carimbo de "${stamp.participantName}" no evento "${stamp.eventName}"?`
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/stamps", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stampId: stamp.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao excluir carimbo.");
      }

      setSuccess(data.message || "Carimbo excluído do banco de dados!");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao excluir carimbo.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualStamp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPassportId || !selectedEventId || !manualJustification.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/stamps/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          passportId: selectedPassportId,
          eventId: selectedEventId,
          justification: manualJustification.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao aplicar carimbo manual.");
      }

      setSuccess("Carimbo manual de contingência aplicado com sucesso.");
      setIsManualModalOpen(false);
      setManualJustification("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha na contingência manual.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Registro e Auditoria de Carimbos</h1>
          <p className="text-sm text-muted">
            Histórico completo de presenças confirmadas e cancelamentos justificados.
          </p>
        </div>

        <button
          onClick={() => setIsManualModalOpen(true)}
          className="rounded-xl border border-premium/40 bg-premium/10 px-4 py-2 text-xs font-bold text-premium hover:bg-premium/20 transition"
        >
          Carimbo Manual (Contingência ADMIN)
        </button>
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

      {/* Modal de Cancelamento com Justificativa Obrigatória */}
      {cancellingStampId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-danger/30 bg-surface p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-danger">Cancelamento de Presença</h3>
            <p className="text-xs text-muted">
              Por auditoria, o registro não é excluído. A justificativa, data e administrador responsável serão gravados permanentemente no banco.
            </p>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Motivo / Justificativa (obrigatório)
              </label>
              <textarea
                required
                rows={3}
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Ex: Registro incorreto devido a teste de validação..."
                className="w-full rounded-xl border border-muted/30 bg-background p-3 text-xs text-foreground focus:border-danger focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCancellingStampId(null);
                  setCancellationReason("");
                }}
                className="h-10 flex-1 rounded-xl border border-muted/30 text-xs font-semibold text-muted hover:text-foreground transition"
              >
                Voltar
              </button>
              <button
                onClick={handleCancelStamp}
                disabled={loading || cancellationReason.trim().length < 5}
                className="h-10 flex-1 rounded-xl bg-danger font-bold text-white hover:bg-danger/90 transition disabled:opacity-50"
              >
                {loading ? "Cancelando..." : "Confirmar Cancelamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Carimbo Manual de Contingência */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <form onSubmit={handleManualStamp} className="w-full max-w-md rounded-2xl border border-premium/30 bg-surface p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-premium">Carimbo Manual de Contingência</h3>
            <p className="text-xs text-muted">
              Uso restrito para participantes com problemas de câmera ou internet no local do evento. Registrado com tag MANUAL_ADMIN.
            </p>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Participante</label>
              <select
                value={selectedPassportId}
                onChange={(e) => setSelectedPassportId(e.target.value)}
                className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:outline-none"
              >
                {activePassports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.participantName} ({p.passportNumber})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Evento Ativo</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:outline-none"
              >
                {activeEvents.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Justificativa Obrigatória
              </label>
              <input
                type="text"
                required
                value={manualJustification}
                onChange={(e) => setManualJustification(e.target.value)}
                placeholder="Ex: Dispositivo do convidado sem bateria"
                className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="h-10 flex-1 rounded-xl border border-muted/30 text-xs font-semibold text-muted hover:text-foreground transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || manualJustification.trim().length < 5}
                className="h-10 flex-1 rounded-xl bg-primary font-bold text-white hover:bg-primary/90 transition disabled:opacity-50"
              >
                {loading ? "Aplicando..." : "Confirmar Carimbo Manual"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela de Carimbos */}
      <div className="overflow-hidden rounded-2xl border border-primary/20 bg-surface shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-muted/20 bg-background/50 text-muted uppercase text-[10px] font-bold">
              <tr>
                <th className="p-4">Status</th>
                <th className="p-4">Participante</th>
                <th className="p-4">Passaporte</th>
                <th className="p-4">Evento</th>
                <th className="p-4">Atendente</th>
                <th className="p-4">Data / Hora</th>
                <th className="p-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/10">
              {stamps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted">
                    Nenhum carimbo registrado.
                  </td>
                </tr>
              ) : (
                stamps.map((s) => {
                  const isConfirmed = s.status === "CONFIRMED";

                  return (
                    <tr key={s.id} className="hover:bg-white/5 transition">
                      <td className="p-4">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                            isConfirmed
                              ? "bg-success/10 text-success border-success/30"
                              : "bg-danger/10 text-danger border-danger/30"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-foreground">
                        {s.participantName}
                        <p className="text-[10px] font-normal text-muted">{s.participantEmail}</p>
                      </td>
                      <td className="p-4 font-mono text-secondary">{s.passportNumber}</td>
                      <td className="p-4 text-foreground font-medium">{s.eventName}</td>
                      <td className="p-4 text-muted">{s.attendantName}</td>
                      <td className="p-4 text-muted">
                        {new Date(s.stampedAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {s.cancelledAt && (
                          <p className="text-[10px] text-danger mt-0.5">
                            Cancelado em {new Date(s.cancelledAt).toLocaleDateString("pt-BR")} por {s.cancelledByName} ({s.cancellationReason})
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isConfirmed && (
                            <button
                              onClick={() => setCancellingStampId(s.id)}
                              className="rounded-lg border border-warning/40 px-2 py-1 text-[11px] font-semibold text-warning hover:bg-warning/10 transition cursor-pointer"
                              title="Cancelar carimbo com justificativa"
                            >
                              Cancelar
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteStampPermanent(s)}
                            disabled={loading}
                            className="rounded-lg border border-danger/30 px-2 py-1 text-[11px] font-semibold text-danger hover:bg-danger/10 transition cursor-pointer"
                            title="Excluir registro de carimbo permanentemente"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
