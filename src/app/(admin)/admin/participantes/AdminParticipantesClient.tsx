"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ParticipantItem {
  id: string; // userId
  name: string;
  email: string;
  image: string | null;
  realEstateAgency: string | null;
  passportId: string;
  passportNumber: string;
  stampsCount: number;
  lgpdConsent: boolean;
  lgpdConsentVersion: string | null;
  createdAt: string;
}

export function AdminParticipantesClient({
  initialParticipants,
}: {
  initialParticipants: ParticipantItem[];
}) {
  const router = useRouter();
  const [participants, setParticipants] = useState<ParticipantItem[]>(initialParticipants);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setParticipants(initialParticipants);
  }, [initialParticipants]);

  const handleDeleteParticipant = async (p: ParticipantItem) => {
    const confirmed = confirm(
      `Tem certeza que deseja excluir o participante "${p.name}" (${p.email})?\n\nEsta ação apagará permanentemente o passaporte ${p.passportNumber}, seus carimbos e liberará a vaga do convite correspondente.`
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/participants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: p.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao excluir participante.");
      }

      setSuccess(data.message || "Participante excluído com sucesso!");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao excluir participante.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Participantes do Bar JRC</h1>
          <p className="text-xs text-muted mt-1">
            Gestão de participantes, imobiliárias parceiras, consentimento LGPD e carimbos conquistados.
          </p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs text-secondary font-semibold">
          Total: {participants.length} participante(s)
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger font-medium">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="rounded-xl border border-secondary/30 bg-secondary/10 p-3 text-sm text-secondary font-bold">
          {success}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-primary/20 bg-surface shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-muted/20 bg-background/50 text-muted uppercase text-[10px] font-bold">
              <tr>
                <th className="p-4">Participante</th>
                <th className="p-4">Imobiliária</th>
                <th className="p-4">E-mail</th>
                <th className="p-4">Passaporte</th>
                <th className="p-4">Carimbos (de 12)</th>
                <th className="p-4">Termo LGPD</th>
                <th className="p-4">Data Cadastro</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/10">
              {participants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted">
                    Nenhum participante cadastrado até o momento.
                  </td>
                </tr>
              ) : (
                participants.map((p) => (
                  <tr key={p.id} className="hover:bg-white/5 transition">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-premium">
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            p.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <span className="font-bold text-foreground">{p.name}</span>
                      </div>
                    </td>
                    <td className="p-4 font-medium text-foreground">
                      {p.realEstateAgency ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-surface/80 border border-muted/20 px-2 py-0.5 text-premium font-semibold">
                          🏢 {p.realEstateAgency}
                        </span>
                      ) : (
                        <span className="text-muted/50">—</span>
                      )}
                    </td>
                    <td className="p-4 text-muted">{p.email}</td>
                    <td className="p-4 font-mono font-bold text-secondary">{p.passportNumber}</td>
                    <td className="p-4 font-bold text-success">
                      {p.stampsCount} / 12
                    </td>
                    <td className="p-4">
                      {p.lgpdConsent ? (
                        <span className="inline-block rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success border border-success/30">
                          ✓ Aceito ({p.lgpdConsentVersion || "1.0"})
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger border border-danger/30">
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-muted">
                      {new Date(p.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDeleteParticipant(p)}
                        disabled={loading}
                        className="rounded-lg border border-danger/30 px-2.5 py-1 text-[11px] font-semibold text-danger hover:bg-danger/10 transition cursor-pointer"
                        title="Excluir participante e liberar vaga"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
