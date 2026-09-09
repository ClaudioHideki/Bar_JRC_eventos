"use client";

import { useState, useRef } from "react";
import Image from "next/image";

interface AdminTemasClientProps {
  initialTheme: {
    themeImageUrl: string;
    themeTitle: string;
    themeSubtitle: string;
  };
}

export function AdminTemasClient({ initialTheme }: AdminTemasClientProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [themeImageUrl, setThemeImageUrl] = useState(initialTheme.themeImageUrl || "/brand/passaporte-template.jpg");
  const [themeTitle, setThemeTitle] = useState(initialTheme.themeTitle || "Passaporte JRC");
  const [themeSubtitle, setThemeSubtitle] = useState(initialTheme.themeSubtitle || "Dezembro é seu. Se você estiver lá até o fim.");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem (JPEG ou PNG).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setThemeImageUrl(reader.result as string);
      setSuccess("Nova arte carregada para pré-visualização! Clique em Salvar Alterações para aplicar.");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themeImageUrl,
          themeTitle,
          themeSubtitle,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao salvar tema.");
      }

      setSuccess("Tema visual atualizado com sucesso! Todos os participantes verão o novo layout mantendo seus carimbos intactos.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar tema.");
    } finally {
      setLoading(false);
    }
  };

  const resetToDefault = () => {
    setThemeImageUrl("/brand/passaporte-template.jpg");
    setThemeTitle("Passaporte JRC");
    setThemeSubtitle("Dezembro é seu. Se você estiver lá até o fim.");
    setSuccess("Tema restaurado para a arte oficial padrão.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">
          Gestão de Temas do Passaporte (Marketing)
        </h1>
        <p className="text-xs text-muted mt-1">
          Altere a arte visual e o tema da edição do Bar JRC. Os 12 carimbos e presenças dos participantes permanecem 100% preservados.
        </p>
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
        {/* Formulário de Configuração */}
        <form onSubmit={handleSave} className="rounded-3xl border border-primary/20 bg-surface p-6 shadow-xl space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-premium">
            Configuração da Edição Atual
          </h2>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
              Arte de Fundo do Passaporte
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={themeImageUrl.startsWith("data:") ? "[Imagem personalizada carregada via upload]" : themeImageUrl}
                onChange={(e) => setThemeImageUrl(e.target.value)}
                placeholder="/brand/passaporte-template.jpg ou URL externa"
                className="h-11 flex-1 rounded-xl border border-muted/30 bg-background px-3 text-xs text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-primary/40 bg-primary/10 px-4 text-xs font-bold text-primary hover:bg-primary/20 transition whitespace-nowrap"
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
              placeholder="Ex: Passaporte JRC - Especial Bar JRC"
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
              placeholder="Ex: Dezembro é seu. Se você estiver lá até o fim."
              className="w-full rounded-xl border border-muted/30 bg-background p-3 text-xs text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none"
            />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-gradient-to-r from-primary to-secondary py-3 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:opacity-95 transition disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar Alterações de Tema"}
            </button>
            <button
              type="button"
              onClick={resetToDefault}
              className="rounded-xl border border-muted/30 px-4 py-3 text-xs text-muted hover:text-foreground transition"
            >
              Restaurar Padrão
            </button>
          </div>
        </form>

        {/* Pré-visualização do Passaporte */}
        <div className="rounded-3xl border border-primary/20 bg-surface p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-premium">
              Pré-visualização do Passaporte
            </h2>
            <span className="text-[10px] rounded-full bg-secondary/10 px-2 py-0.5 text-secondary border border-secondary/30 font-bold">
              Tempo Real
            </span>
          </div>

          <div className="relative mx-auto max-w-sm rounded-2xl overflow-hidden border-2 border-premium/50 shadow-xl bg-black">
            <div className="relative w-full aspect-[3/4]">
              <Image
                src={themeImageUrl}
                alt="Prévia do tema"
                fill
                className="object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 inset-x-4 text-center">
                <p className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">
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
