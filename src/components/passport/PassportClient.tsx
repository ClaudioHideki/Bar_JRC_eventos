"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { QrModal } from "@/components/passport/QrModal";
import { authClient } from "@/lib/auth/client";

interface StampData {
  id: string;
  eventId: string;
  stampedAt: string;
  event: {
    name: string;
    description: string | null;
    stampColor: string;
  };
}

interface EventItem {
  id: string;
  name: string;
  description: string | null;
  orderIndex: number;
  startDate: string;
  themeImageUrl?: string | null;
}

interface UpcomingEventData {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  location: string | null;
  themeImageUrl?: string | null;
}

interface PassportClientProps {
  userName: string;
  userEmail: string;
  userImage: string | null;
  realEstateAgency: string | null;
  passportNumber: string;
  programName: string;
  themeImageUrl: string;
  activeEventThemeUrl?: string | null;
  activeEventName?: string | null;
  events: EventItem[];
  stamps: StampData[];
  upcomingEvents: UpcomingEventData[];
}

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export function PassportClient({
  userName,
  userEmail,
  userImage: initialUserImage,
  realEstateAgency,
  passportNumber,
  programName,
  themeImageUrl,
  activeEventThemeUrl,
  activeEventName,
  events,
  stamps,
  upcomingEvents,
}: PassportClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const passportCardRef = useRef<HTMLElement>(null);

  const [isQrOpen, setIsQrOpen] = useState(false);
  const [userImage, setUserImage] = useState<string | null>(initialUserImage);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);

  // Arte selecionada para o passaporte (padrão ou do evento ativo)
  const initialTheme = activeEventThemeUrl || themeImageUrl || "/brand/passaporte-template.jpg";
  const [displayedThemeUrl, setDisplayedThemeUrl] = useState<string>(initialTheme);
  const [displayedThemeTitle, setDisplayedThemeTitle] = useState<string>(
    activeEventThemeUrl && activeEventName ? `Edição: ${activeEventName}` : "Arte Oficial JRC"
  );

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPhotoError("Por favor, selecione um arquivo de imagem válido.");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setPhotoError("A imagem deve ter no máximo 4MB.");
      return;
    }

    setUploadingPhoto(true);
    setPhotoError(null);
    setPhotoSuccess(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const res = await fetch("/api/user/profile-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ imageBase64: base64 }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Erro ao salvar foto.");
        }

        setUserImage(base64);
        setPhotoSuccess("Foto atualizada com sucesso! Seus carimbos continuam preservados.");
        setTimeout(() => setPhotoSuccess(null), 4000);
      } catch (err: unknown) {
        setPhotoError(err instanceof Error ? err.message : "Erro ao enviar imagem.");
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const switchThemeToEvent = (evtName: string, imgUrl: string) => {
    setDisplayedThemeUrl(imgUrl);
    setDisplayedThemeTitle(`Edição: ${evtName}`);
    passportCardRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const resetThemeToOfficial = () => {
    setDisplayedThemeUrl(themeImageUrl || "/brand/passaporte-template.jpg");
    setDisplayedThemeTitle("Arte Oficial JRC");
    passportCardRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Mapeia os 12 slots mensais (Janeiro a Dezembro)
  const slots = Array.from({ length: 12 }).map((_, idx) => {
    const event = events[idx];
    const stamp = stamps.find((s) => event && s.eventId === event.id);
    return {
      slotIndex: idx + 1,
      monthLabel: MONTH_NAMES[idx],
      event,
      stamp,
    };
  });

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      {/* Barra superior de navegação */}
      <header className="border-b border-primary/20 bg-surface/90 px-4 py-3 backdrop-blur sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-xs font-bold text-premium border border-primary/30">
            JRC
          </div>
          <div>
            <span className="block text-xs font-bold tracking-wider text-foreground uppercase">
              {programName}
            </span>
            <span className="block text-[10px] text-muted">JRC Construtora 40 Anos</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-muted/30 px-3 py-1.5 text-xs text-muted hover:text-foreground transition hover:border-muted/60 cursor-pointer"
        >
          Sair
        </button>
      </header>

      <main className="mx-auto max-w-xl p-4 space-y-6">
        {/* Notificações de Troca de Foto */}
        {photoSuccess && (
          <div className="rounded-2xl border border-success/40 bg-success/10 p-3 text-xs text-success text-center font-medium animate-in fade-in">
            {photoSuccess}
          </div>
        )}
        {photoError && (
          <div className="rounded-2xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger text-center font-medium animate-in fade-in">
            {photoError}
          </div>
        )}

        {/* Card de Identificação do Participante com Foto */}
        <section className="rounded-3xl border border-primary/30 bg-surface/90 p-5 shadow-xl backdrop-blur space-y-4">
          <div className="flex items-center gap-4">
            {/* Foto 3x4 / Avatar com Troca */}
            <div className="relative group shrink-0">
              <div className="h-16 w-16 overflow-hidden rounded-2xl border-2 border-premium/60 bg-background shadow-md flex items-center justify-center">
                {userImage ? (
                  <img
                    src={userImage}
                    alt={userName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-black text-premium">
                    {userName.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                title="Trocar Foto"
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-md hover:bg-primary/90 transition text-[10px] cursor-pointer"
              >
                {uploadingPhoto ? "..." : "📷"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Dados do Participante */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-foreground truncate">
                  {userName}
                </h1>
              </div>
              {realEstateAgency && (
                <p className="text-xs text-premium font-semibold truncate flex items-center gap-1 mt-0.5">
                  <span>🏢</span> {realEstateAgency}
                </p>
              )}
              <p className="text-[11px] text-muted truncate mt-0.5">{userEmail}</p>
            </div>

            {/* Número do Passaporte */}
            <div className="text-right shrink-0">
              <span className="block text-[9px] uppercase tracking-wider text-muted">Passaporte</span>
              <span className="font-mono text-xs font-bold text-secondary">{passportNumber}</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-muted/10 pt-3 text-xs">
            <div>
              <span className="text-muted text-[11px]">Progresso da Campanha:</span>
              <p className="font-bold text-success text-sm">
                {stamps.length} <span className="text-xs font-normal text-muted">de 12 carimbos mensais</span>
              </p>
            </div>
            <button
              onClick={() => setIsQrOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/20 transition hover:opacity-95 active:scale-95 cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
              Exibir QR Code para Carimbar
            </button>
          </div>
        </section>

        {/* PASSAPORTE OFICIAL — ARTE BAR JRC COM OS 12 CARIMBOS */}
        <section
          ref={passportCardRef}
          aria-label="Passaporte Oficial Bar JRC"
          className="relative overflow-hidden rounded-3xl border-2 border-premium/50 shadow-2xl shadow-primary/20 bg-black"
        >
          {/* Seletor / Indicador da Arte Exibida */}
          <div className="absolute top-3 inset-x-3 z-10 flex items-center justify-between pointer-events-auto">
            <span className="rounded-full bg-black/70 backdrop-blur-md px-3 py-1 text-[10px] font-bold text-amber-300 border border-amber-400/30">
              🎨 {displayedThemeTitle}
            </span>

            {displayedThemeTitle !== "Arte Oficial JRC" && (
              <button
                type="button"
                onClick={resetThemeToOfficial}
                className="rounded-full bg-black/70 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-white/80 hover:text-white border border-white/20 transition cursor-pointer"
              >
                Voltar à Arte Oficial
              </button>
            )}
          </div>

          {/* Imagem de Fundo Dinâmica do Passaporte */}
          <div className="relative w-full aspect-[4/5] sm:aspect-[3/4] overflow-hidden">
            <Image
              src={displayedThemeUrl}
              alt="Passaporte JRC Oficial"
              fill
              priority
              className="object-cover object-top select-none transition-opacity duration-500"
            />

            {/* Camada sutil de gradiente para contraste */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

            {/* GRADE INTERATIVA DOS 12 CARIMBOS (Posicionada sobre os quadrantes inferiores) */}
            <div className="absolute bottom-[8%] inset-x-[6%] z-10">
              <div className="text-center mb-2.5">
                <span className="inline-block rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 backdrop-blur border border-amber-400/40">
                  {stamps.length === 12
                    ? "🏆 Parabéns! 12 Carimbos Completados — Dezembro é Seu!"
                    : `${stamps.length} de 12 Carimbos Conquistados`}
                </span>
              </div>

              {/* Grid 2 linhas x 6 colunas = 12 quadrantes exatos */}
              <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                {slots.map((slot) => {
                  const isStamped = Boolean(slot.stamp);

                  return (
                    <div
                      key={slot.slotIndex}
                      className={`relative flex flex-col items-center justify-center rounded-xl p-1 text-center aspect-square transition-all duration-300 ${
                        isStamped
                          ? "bg-amber-400/25 border-2 border-amber-400 shadow-lg shadow-amber-500/30 scale-100"
                          : "bg-black/40 border border-white/25 hover:border-white/50 backdrop-blur-sm"
                      }`}
                    >
                      {isStamped ? (
                        /* Selo Carimbado com Efeito de Tinta Dourada */
                        <div className="flex flex-col items-center justify-center">
                          <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-amber-400/30 border border-amber-300 text-amber-300 shadow-inner">
                            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                          <span className="text-[9px] sm:text-[10px] font-black text-amber-300 uppercase tracking-tighter mt-0.5">
                            {slot.monthLabel}
                          </span>
                        </div>
                      ) : (
                        /* Slot Disponível / Pendente */
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[10px] sm:text-xs font-bold text-white/80">
                            {slot.monthLabel}
                          </span>
                          <span className="text-[8px] text-white/40 font-mono mt-0.5">
                            #{slot.slotIndex}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Lista de Próximos Eventos Bar JRC com Arte Temática */}
        <section aria-labelledby="upcoming-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="upcoming-heading" className="text-xs font-bold tracking-wider text-muted uppercase">
              Próximos Encontros Mensais
            </h2>
            <span className="text-[11px] text-premium font-medium">Bar JRC 2026</span>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="rounded-2xl border border-muted/20 bg-surface p-4 text-center text-xs text-muted">
              Nenhum evento futuro agendado no momento.
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between rounded-2xl border border-primary/20 bg-surface p-3.5 transition hover:border-primary/40 gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail da Arte Temática se houver */}
                    {evt.themeImageUrl ? (
                      <div className="relative h-12 w-10 shrink-0 rounded-lg overflow-hidden border border-secondary/40 shadow-md">
                        <Image
                          src={evt.themeImageUrl}
                          alt={evt.name}
                          fill
                          className="object-cover object-top"
                        />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-xs font-bold text-premium">
                        JRC
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-foreground truncate">{evt.name}</h3>
                        {evt.themeImageUrl && (
                          <span className="text-[9px] rounded-full bg-secondary/15 px-2 py-0.2 text-secondary font-bold border border-secondary/30">
                            Arte Especial
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">
                        {evt.location || "Espaço Bar JRC"} •{" "}
                        {new Date(evt.startDate).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {evt.themeImageUrl && (
                      <button
                        type="button"
                        onClick={() => switchThemeToEvent(evt.name, evt.themeImageUrl!)}
                        className="rounded-lg border border-secondary/40 bg-secondary/10 px-2.5 py-1 text-[10px] font-bold text-secondary hover:bg-secondary/20 transition cursor-pointer"
                      >
                        Ver Arte
                      </button>
                    )}
                    <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold text-secondary border border-secondary/30">
                      Mensal
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modal de QR Code com 5 minutos de validade para a recepcionista carimbar */}
      <QrModal isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} />
    </div>
  );
}
