"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
  themeImageUrl: string | null;
}

export function AdminEventosClient({ initialEvents }: { initialEvents: EventItem[] }) {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>(initialEvents);

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  const [isCreating, setIsCreating] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states (Create)
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [themeImageUrl, setThemeImageUrl] = useState("");
  const createFileInputRef = useRef<HTMLInputElement>(null);

  // Form states (Edit)
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editThemeImageUrl, setEditThemeImageUrl] = useState("");
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = (
    file: File,
    onSuccess: (dataUrl: string) => void,
    onError: (msg: string) => void
  ) => {
    if (!file.type.startsWith("image/")) {
      onError("Selecione um arquivo de imagem válido (JPEG, PNG ou WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError("A imagem deve ter no máximo 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onSuccess(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

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
          themeImageUrl: themeImageUrl.trim() ? themeImageUrl : null,
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
      setThemeImageUrl("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao criar evento.");
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (evt: EventItem) => {
    setEditingEvent(evt);
    setEditName(evt.name);
    setEditDescription(evt.description || "");
    setEditLocation(evt.location || "");
    setEditStartDate(evt.startDate.slice(0, 16));
    setEditEndDate(evt.endDate.slice(0, 16));
    setEditThemeImageUrl(evt.themeImageUrl || "");
    setError(null);
    setSuccess(null);
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          eventId: editingEvent.id,
          name: editName,
          description: editDescription,
          location: editLocation,
          startDate: editStartDate,
          endDate: editEndDate,
          themeImageUrl: editThemeImageUrl.trim() ? editThemeImageUrl : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao atualizar evento.");
      }

      setSuccess(`Evento "${editName}" atualizado com sucesso!`);
      setEditingEvent(null);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar evento.");
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
            Configure as edições mensais e vincule artes temáticas exclusivas para cada evento do passaporte.
          </p>
        </div>

        <button
          onClick={() => {
            setIsCreating(!isCreating);
            setEditingEvent(null);
            setError(null);
            setSuccess(null);
          }}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 transition shadow-md shadow-primary/20"
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

      {/* Modal / Formulário de Edição */}
      {editingEvent && (
        <div className="rounded-2xl border-2 border-secondary/40 bg-surface p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-secondary">
              Editar Evento #{editingEvent.orderIndex}: {editingEvent.name}
            </h3>
            <button
              onClick={() => setEditingEvent(null)}
              className="text-xs text-muted hover:text-foreground font-bold"
            >
              ✕ Fechar
            </button>
          </div>

          <form onSubmit={handleUpdateEvent} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1 font-semibold uppercase">Nome do Evento *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:border-secondary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1 font-semibold uppercase">Local / Sala</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:border-secondary focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1 font-semibold uppercase">Data / Hora de Início *</label>
                <input
                  type="datetime-local"
                  required
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:border-secondary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1 font-semibold uppercase">Data / Hora de Término *</label>
                <input
                  type="datetime-local"
                  required
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="h-10 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:border-secondary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted mb-1 font-semibold uppercase">Descrição</label>
              <textarea
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded-xl border border-muted/30 bg-background p-3 text-xs text-foreground focus:border-secondary focus:outline-none"
              />
            </div>

            {/* Arte / Tema do Evento na Edição */}
            <div className="rounded-xl border border-muted/20 bg-background/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs text-secondary font-bold uppercase">Arte / Tema Exclusivo do Evento</label>
                  <p className="text-[11px] text-muted">
                    Quando definido, o passaporte exibirá esta arte temática quando este evento for o ativo. Deixe vazio para usar o tema padrão.
                  </p>
                </div>
                {editThemeImageUrl && (
                  <button
                    type="button"
                    onClick={() => setEditThemeImageUrl("")}
                    className="text-[10px] text-danger hover:underline font-bold"
                  >
                    Remover arte (usar padrão)
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={editThemeImageUrl.startsWith("data:") ? "[Nova imagem selecionada]" : editThemeImageUrl}
                  onChange={(e) => setEditThemeImageUrl(e.target.value)}
                  placeholder="URL externa ou clique ao lado para upload..."
                  className="h-10 flex-1 rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:border-secondary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => editFileInputRef.current?.click()}
                  className="rounded-xl border border-secondary/40 bg-secondary/10 px-4 text-xs font-bold text-secondary hover:bg-secondary/20 transition whitespace-nowrap"
                >
                  Upload Imagem
                </button>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageFile(f, (dataUrl) => setEditThemeImageUrl(dataUrl), (msg) => setError(msg));
                  }}
                  className="hidden"
                />
              </div>

              {editThemeImageUrl && (
                <div className="flex items-center gap-3 pt-1">
                  <div className="relative h-14 w-11 rounded-lg overflow-hidden border border-secondary/50 shadow-md">
                    <Image
                      src={editThemeImageUrl}
                      alt="Prévia da arte"
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                  <span className="text-[11px] text-success font-medium">✓ Arte vinculada a este evento</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-secondary px-5 py-2.5 text-xs font-bold text-background hover:bg-secondary/90 disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? "Salvando..." : "Salvar Alterações"}
              </button>
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                className="rounded-xl border border-muted/30 px-4 py-2.5 text-xs text-muted hover:text-foreground transition cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
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

          {/* Arte / Tema do Evento */}
          <div className="rounded-xl border border-muted/20 bg-background/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs text-premium font-bold uppercase">Arte / Tema Exclusivo do Evento (Opcional)</label>
                <p className="text-[11px] text-muted">
                  Vincule a arte visual personalizada para este evento. Se não informar, o sistema utilizará a arte padrão do programa.
                </p>
              </div>
              {themeImageUrl && (
                <button
                  type="button"
                  onClick={() => setThemeImageUrl("")}
                  className="text-[10px] text-danger hover:underline font-bold"
                >
                  Remover
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={themeImageUrl.startsWith("data:") ? "[Imagem selecionada via upload]" : themeImageUrl}
                onChange={(e) => setThemeImageUrl(e.target.value)}
                placeholder="/brand/passaporte-template.jpg, URL externa ou clique em Upload..."
                className="h-10 flex-1 rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => createFileInputRef.current?.click()}
                className="rounded-xl border border-primary/40 bg-primary/10 px-4 text-xs font-bold text-primary hover:bg-primary/20 transition whitespace-nowrap"
              >
                Upload Arte
              </button>
              <input
                ref={createFileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageFile(f, (dataUrl) => setThemeImageUrl(dataUrl), (msg) => setError(msg));
                }}
                className="hidden"
              />
            </div>

            {themeImageUrl && (
              <div className="flex items-center gap-3 pt-1">
                <div className="relative h-14 w-11 rounded-lg overflow-hidden border border-primary/50 shadow-md">
                  <Image
                    src={themeImageUrl}
                    alt="Prévia da arte do evento"
                    fill
                    className="object-cover object-top"
                  />
                </div>
                <span className="text-[11px] text-success font-medium">✓ Arte temática pronta para ser salva</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50 shadow-md shadow-primary/20 cursor-pointer"
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
                <th className="p-4">Arte / Tema</th>
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
                  
                  {/* Arte / Tema do Evento */}
                  <td className="p-4">
                    {evt.themeImageUrl ? (
                      <div className="flex items-center gap-2">
                        <div className="relative h-10 w-8 rounded-md overflow-hidden border border-primary/40 shadow-sm shrink-0">
                          <Image
                            src={evt.themeImageUrl}
                            alt={evt.name}
                            fill
                            className="object-cover object-top"
                          />
                        </div>
                        <span className="text-[10px] text-secondary font-semibold">Exclusiva</span>
                      </div>
                    ) : (
                      <span className="inline-block rounded-md bg-muted/10 px-2 py-0.5 text-[10px] text-muted border border-muted/20">
                        Padrão
                      </span>
                    )}
                  </td>

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
                      <button
                        onClick={() => openEditModal(evt)}
                        disabled={loading}
                        title="Editar evento e arte"
                        className="rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/20 transition cursor-pointer"
                      >
                        Editar
                      </button>

                      <select
                        value={evt.status}
                        disabled={loading}
                        onChange={(e) => handleStatusChange(evt.id, e.target.value)}
                        className="rounded-lg border border-muted/30 bg-background px-2 py-1 text-[11px] text-foreground focus:outline-none cursor-pointer"
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
