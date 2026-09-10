"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

interface EventThemeItem {
  id: string;
  name: string;
  orderIndex: number;
  themeImageUrl: string | null;
}

interface AdminTemasClientProps {
  initialTheme: {
    themeImageUrl: string;
    themeTitle: string;
    themeSubtitle: string;
  };
  initialEvents: EventThemeItem[];
}

export function AdminTemasClient({ initialTheme, initialEvents }: AdminTemasClientProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [events, setEvents] = useState<EventThemeItem[]>(initialEvents);

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  // Modo: "program" (Geral) ou ID do evento selecionado
  const [selectedTarget, setSelectedTarget] = useState<string>("program");

  // Estado do Tema do Programa
  const [programImageUrl, setProgramImageUrl] = useState(initialTheme.themeImageUrl || "/brand/passaporte-template.jpg");
  const [themeTitle, setThemeTitle] = useState(initialTheme.themeTitle || "Passaporte JRC");
  const [themeSubtitle, setThemeSubtitle] = useState(initialTheme.themeSubtitle || "Setembro de 2027 é seu. Se você estiver lá até o fim.");

  // Estado da Arte do Evento selecionado
  const [eventImageUrl, setEventImageUrl] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quando muda o alvo selecionado (Programa vs Evento X)
  const handleTargetChange = (target: string) => {
    setSelectedTarget(target);
    setError(null);
    setSuccess(null);

    if (target !== "program") {
      const ev = events.find((e) => e.id === target);
      setEventImageUrl(ev?.themeImageUrl || "");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem (JPEG, PNG ou WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (selectedTarget === "program") {
        setProgramImageUrl(dataUrl);
      } else {
        setEventImageUrl(dataUrl);
      }
      setSuccess("Nova arte carregada para pré-visualização! Clique em Salvar para aplicar.");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProgramTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          themeImageUrl: programImageUrl,
          themeTitle,
          themeSubtitle,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao salvar tema.");
      }

      setSuccess("Tema visual do programa atualizado com sucesso! Todos os participantes verão o novo layout.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar tema.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEventTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTarget === "program") return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          eventId: selectedTarget,
          themeImageUrl: eventImageUrl.trim() ? eventImageUrl : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao salvar arte do evento.");
      }

      setEvents((prev) =>
        prev.map((e) =>
          e.id === selectedTarget ? { ...e, themeImageUrl: eventImageUrl.trim() ? eventImageUrl : null } : e
        )
      );

      const evName = events.find((e) => e.id === selectedTarget)?.name || "Evento";
      setSuccess(`Arte exclusiva do "${evName}" salva com sucesso!`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar arte.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveEventTheme = async () => {
    if (selectedTarget === "program") return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          eventId: selectedTarget,
          themeImageUrl: null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao remover arte do evento.");
      }

      setEventImageUrl("");
      setEvents((prev) =>
        prev.map((e) => (e.id === selectedTarget ? { ...e, themeImageUrl: null } : e))
      );
      setSuccess("Arte exclusiva removida. O evento agora usará a arte padrão do programa.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao remover arte.");
    } finally {
      setLoading(false);
    }
  };

  const resetProgramDefault = () => {
    setProgramImageUrl("/brand/passaporte-template.jpg");
    setThemeTitle("Passaporte JRC");
    setThemeSubtitle("Setembro de 2027 é seu. Se você estiver lá até o fim.");
    setSuccess("Tema restaurado para a arte oficial padrão.");
  };

  const selectedEvent = events.find((e) => e.id === selectedTarget);
  const activePreviewImage =
    selectedTarget === "program"
      ? programImageUrl
      : eventImageUrl || programImageUrl || "/brand/passaporte-template.jpg";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">
          Gestão de Artes e Temas do Passaporte
        </h1>
        <p className="text-xs text-muted mt-1">
          Configure a arte geral do passaporte ou vincule artes exclusivas para cada edição mensal do Bar JRC.
        </p>
      </div>

      {/* Seletor de Escopo: Geral vs Evento Específico */}
      <div className="rounded-2xl border border-primary/30 bg-surface p-4 shadow-lg space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-muted">
          Selecione a arte que deseja configurar:
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleTargetChange("program")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              selectedTarget === "program"
                ? "bg-primary text-white shadow-md shadow-primary/25"
                : "border border-muted/30 bg-background/50 text-muted hover:text-foreground hover:border-primary/40"
            }`}
          >
            🎨 Arte Geral do Passaporte (Padrão)
          </button>

          {events.map((evt) => (
            <button
              key={evt.id}
              type="button"
              onClick={() => handleTargetChange(evt.id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                selectedTarget === evt.id
                  ? "bg-secondary text-background font-bold shadow-md shadow-secondary/25"
                  : "border border-muted/30 bg-background/50 text-muted hover:text-foreground hover:border-secondary/40"
              }`}
            >
              <span>#{evt.orderIndex} {evt.name}</span>
              {evt.themeImageUrl && (
                <span className="h-2 w-2 rounded-full bg-secondary inline-block" title="Possui arte exclusiva" />
              )}
            </button>
          ))}
        </div>
      </div>

      {success && (
        <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-xs font-medium text-success">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-xs font-medium text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Formulário de Configuração dependendo do alvo selecionado */}
        {selectedTarget === "program" ? (
          /* Formulário de Tema Geral */
          <form onSubmit={handleSaveProgramTheme} className="rounded-3xl border border-primary/20 bg-surface p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-premium">
                Arte Geral do Passaporte (Padrão)
              </h2>
              <span className="text-[10px] rounded-full bg-primary/10 px-2.5 py-0.5 text-primary border border-primary/30 font-bold">
                Tema Base
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                Arte de Fundo Padrão
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={programImageUrl.startsWith("data:") ? "[Imagem personalizada carregada via upload]" : programImageUrl}
                  onChange={(e) => setProgramImageUrl(e.target.value)}
                  placeholder="/brand/passaporte-template.jpg ou URL externa"
                  className="h-11 flex-1 rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border border-primary/40 bg-primary/10 px-4 text-xs font-bold text-primary hover:bg-primary/20 transition whitespace-nowrap cursor-pointer"
                >
                  Upload Arte
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              <p className="text-[11px] text-muted mt-1">
                Recomendado: formato vertical (3:4 ou 4:5), alta resolução.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                Título da Campanha
              </label>
              <input
                type="text"
                value={themeTitle}
                onChange={(e) => setThemeTitle(e.target.value)}
                placeholder="Ex: Passaporte JRC - Bar JRC"
                className="h-11 w-full rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                Chamada / Slogan
              </label>
              <textarea
                rows={2}
                value={themeSubtitle}
                onChange={(e) => setThemeSubtitle(e.target.value)}
                placeholder="Ex: Setembro de 2027 é seu. Se você estiver lá até o fim."
                className="w-full rounded-xl border border-muted/30 bg-background p-3 text-xs text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-gradient-to-r from-primary to-secondary py-3 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:opacity-95 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Salvando..." : "Salvar Tema Geral"}
              </button>
              <button
                type="button"
                onClick={resetProgramDefault}
                className="rounded-xl border border-muted/30 px-4 py-3 text-xs text-muted hover:text-foreground transition cursor-pointer"
              >
                Restaurar Padrão
              </button>
            </div>
          </form>
        ) : (
          /* Formulário de Arte do Evento Específico */
          <form onSubmit={handleSaveEventTheme} className="rounded-3xl border border-secondary/30 bg-surface p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">Edição Mensal #{selectedEvent?.orderIndex}</span>
                <h2 className="text-sm font-bold text-foreground">
                  {selectedEvent?.name}
                </h2>
              </div>
              <span className={`text-[10px] rounded-full px-2.5 py-0.5 font-bold border ${
                eventImageUrl
                  ? "bg-secondary/15 text-secondary border-secondary/30"
                  : "bg-muted/10 text-muted border-muted/20"
              }`}>
                {eventImageUrl ? "Arte Exclusiva Ativa" : "Usando Tema Padrão"}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                Arte de Fundo Exclusiva deste Evento
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={eventImageUrl.startsWith("data:") ? "[Imagem personalizada carregada via upload]" : eventImageUrl}
                  onChange={(e) => setEventImageUrl(e.target.value)}
                  placeholder="URL externa ou clique ao lado para upload..."
                  className="h-11 flex-1 rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground placeholder:text-muted/40 focus:border-secondary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border border-secondary/40 bg-secondary/10 px-4 text-xs font-bold text-secondary hover:bg-secondary/20 transition whitespace-nowrap cursor-pointer"
                >
                  Upload Arte
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              <p className="text-[11px] text-muted mt-1">
                Ao salvar, quando este evento for o ativo do mês, o passaporte do participante exibirá esta arte de fundo personalizada.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-secondary py-3 text-xs font-bold text-background shadow-lg shadow-secondary/20 hover:bg-secondary/90 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Salvando..." : `Salvar Arte para "${selectedEvent?.name}"`}
              </button>

              {eventImageUrl && (
                <button
                  type="button"
                  onClick={handleRemoveEventTheme}
                  disabled={loading}
                  className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-xs font-bold text-danger hover:bg-danger/20 transition cursor-pointer"
                >
                  Remover (Voltar ao Padrão)
                </button>
              )}
            </div>
          </form>
        )}

        {/* Pré-visualização do Passaporte em Tempo Real */}
        <div className="rounded-3xl border border-primary/20 bg-surface p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-premium">
                Pré-visualização do Passaporte
              </h2>
              <span className="text-[11px] text-muted">
                {selectedTarget === "program" ? "Visualizando Tema Geral" : `Visualizando Arte: ${selectedEvent?.name}`}
              </span>
            </div>
            <span className="text-[10px] rounded-full bg-secondary/10 px-2 py-0.5 text-secondary border border-secondary/30 font-bold">
              Tempo Real
            </span>
          </div>

          <div className="relative mx-auto max-w-sm rounded-2xl overflow-hidden border-2 border-premium/50 shadow-xl bg-black">
            <div className="relative w-full aspect-[3/4]">
              <Image
                src={activePreviewImage}
                alt="Prévia do tema"
                fill
                className="object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              
              {/* Overlay com informações do tema */}
              <div className="absolute bottom-4 inset-x-4 text-center space-y-1">
                <span className="text-[9px] uppercase tracking-widest text-amber-400 font-mono bg-black/60 px-2 py-0.5 rounded-full border border-amber-400/30">
                  {selectedTarget === "program" ? themeTitle : selectedEvent?.name}
                </span>
                <p className="text-[10px] uppercase tracking-wider text-amber-200 font-bold">
                  {themeSubtitle}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
