"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface EventItem {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  startDate: string;
  endDate: string;
  status: string;
  orderIndex: number;
  confirmedCount: number;
}

export function AdminEventosClient({ initialEvents }: { initialEvents: EventItem[] }) {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>(initialEvents);

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          description,
          location,
          startDate,
          endDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao criar evento.");
      }

      setSuccess("Evento criado com sucesso!");
      setIsCreating(false);
      setName("");
      setDescription("");
      setLocation("");
      setStartDate("");
      setEndDate("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao criar evento.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (eventId: string, newStatus: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventId, status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao atualizar status do evento.");
      }

      setSuccess(`Status alterado para ${newStatus}.`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string, eventName: string, confirmedCount: number) => {
    let forceDelete = false;
    if (confirmedCount > 0) {
      const confirmForce = confirm(
        `Atenção: O evento "${eventName}" possui ${confirmedCount} presença(s) confirmada(s).\n\nDeseja realmente excluir este evento e remover permanentemente todos os carimbos associados a ele?`
      );
      if (!confirmForce) return;
      forceDelete = true;
    } else {
      if (!confirm(`Tem certeza que deseja excluir o evento "${eventName}"?`)) return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventId, forceDelete }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao excluir evento.");
      }

      setSuccess(data.message || "Evento excluído com sucesso!");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao excluir evento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Programação de Eventos</h1>
          <p className="text-sm text-muted">
            Somente eventos com status ACTIVE aceitam carimbos no leitor de atendimento.
          </p>
        </div>

        <button
          onClick={() => {
            setIsCreating(!isCreating);
            setError(null);
            setSuccess(null);
          }}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 transition"
        >
          {isCreating ? "Cancelar" : "+ Novo Evento"}
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

      {/* Formulário de Novo Evento */}
      {isCreating && (
        <form onSubmit={handleCreateEvent} className="rounded-2xl border border-primary/30 bg-surface p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-premium">
            Cadastrar Novo Evento JRC
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1 font-semibold uppercase">Nome do Evento *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Bar JRC - Edição Especial"
                className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1 font-semibold uppercase">Local / Sala</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Espaço Bar JRC"
                className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1 font-semibold uppercase">Data / Hora de Início *</label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1 font-semibold uppercase">Data / Hora de Término *</label>
              <input
                type="datetime-local"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1 font-semibold uppercase">Descrição</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes e objetivos da edição..."
              className="w-full rounded-xl border border-muted/30 bg-background p-3 text-xs text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Salvar Evento"}
          </button>
        </form>
      )}

      {/* Tabela de Eventos */}
      <div className="overflow-hidden rounded-2xl border border-primary/20 bg-surface shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-muted/20 bg-background/50 text-muted uppercase text-[10px] font-bold">
              <tr>
                <th className="p-4">Ordem</th>
                <th className="p-4">Evento</th>
                <th className="p-4">Local</th>
                <th className="p-4">Período</th>
                <th className="p-4">Presenças</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/10">
              {events.map((evt) => (
                <tr key={evt.id} className="hover:bg-white/5 transition">
                  <td className="p-4 font-mono font-bold text-muted">#{evt.orderIndex}</td>
                  <td className="p-4 font-bold text-foreground">
                    <p>{evt.name}</p>
                    {evt.description && <p className="text-[10px] text-muted font-normal line-clamp-1">{evt.description}</p>}
                  </td>
                  <td className="p-4 text-muted">{evt.location || "—"}</td>
                  <td className="p-4 text-muted text-[11px]">
                    {new Date(evt.startDate).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-success">{evt.confirmedCount}</span> carimbos
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                        evt.status === "ACTIVE"
                          ? "bg-success/10 text-success border-success/30"
                          : evt.status === "ENDED"
                            ? "bg-muted/10 text-muted border-muted/30"
                            : evt.status === "CANCELLED"
                              ? "bg-danger/10 text-danger border-danger/30"
                              : "bg-primary/10 text-primary border-primary/30"
                      }`}
                    >
                      {evt.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <select
                        value={evt.status}
                        disabled={loading}
                        onChange={(e) => handleStatusChange(evt.id, e.target.value)}
                        className="rounded-lg border border-muted/30 bg-background px-2 py-1 text-[11px] text-foreground focus:outline-none"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="DRAFT">DRAFT</option>
                        <option value="ENDED">ENDED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>

                      <button
                        onClick={() => handleDeleteEvent(evt.id, evt.name, evt.confirmedCount)}
                        disabled={loading}
                        title="Excluir evento"
                        className="rounded-lg border border-danger/30 px-2 py-1 text-[11px] font-semibold text-danger hover:bg-danger/10 transition cursor-pointer"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
