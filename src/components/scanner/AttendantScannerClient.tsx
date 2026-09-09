"use client";

import { useState, useEffect } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

interface EventOption {
  id: string;
  name: string;
  location: string | null;
}

interface VerificationPreview {
  participantName: string;
  passportNumber: string;
  programName: string;
  eventName: string;
  alreadyStamped: boolean;
  readyToStamp: boolean;
}

export function AttendantScannerClient({
  events,
  attendantName,
}: {
  events: EventOption[];
  attendantName: string;
}) {
  const router = useRouter();
  const [selectedEventId, setSelectedEventId] = useState<string>(events[0]?.id || "");
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState<string>("");
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [preview, setPreview] = useState<VerificationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraDenied, setCameraDenied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function checkCameraAvailability() {
      if (typeof window === "undefined" || !navigator?.mediaDevices?.enumerateDevices) {
        if (isMounted) setHasCamera(false);
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === "videoinput");
        if (isMounted) {
          setHasCamera(videoDevices.length > 0);
        }
      } catch {
        if (isMounted) setHasCamera(false);
      }
    }
    checkCameraAvailability();
    return () => {
      isMounted = false;
    };
  }, []);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setManualToken(text.trim());
      }
    } catch {
      // Falha se permissão não foi concedida pelo navegador; o usuário pode colar com Ctrl+V
    }
  };

  const handleScan = async (detectedCodes: Array<{ rawValue: string }>) => {
    if (!detectedCodes || detectedCodes.length === 0 || loading || !isScanning) return;
    const rawValue = detectedCodes[0].rawValue;
    if (!rawValue) return;

    setIsScanning(false);
    await verifyToken(rawValue);
  };

  const verifyToken = async (token: string) => {
    if (!selectedEventId) {
      setError("Por favor, selecione um evento ativo antes de escanear.");
      setIsScanning(true);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setScannedToken(token);

    try {
      const res = await fetch("/api/stamps/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ qrToken: token, eventId: selectedEventId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao validar QR Code.");
      }

      setPreview(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro na validação do QR Code.");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmStamp = async () => {
    if (!scannedToken || !selectedEventId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stamps/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ qrToken: scannedToken, eventId: selectedEventId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao registrar carimbo.");
      }

      setSuccessMessage(data.message || "Presença carimbada com sucesso!");
      setPreview(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carimbar participante.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setScannedToken(null);
    setManualToken("");
    setPreview(null);
    setError(null);
    setSuccessMessage(null);
    setIsScanning(true);
  };

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      {/* Cabeçalho */}
      <header className="border-b border-primary/20 bg-surface/80 px-4 py-3 backdrop-blur sticky top-0 z-10 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-bold text-foreground">Área do Atendente</span>
          </div>
          <p className="text-[11px] text-muted">Operador: {attendantName}</p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-muted/30 px-3 py-1.5 text-xs text-muted hover:text-foreground transition"
        >
          Sair
        </button>
      </header>

      <main className="mx-auto max-w-md p-4 space-y-5">
        {/* Seletor de Evento Ativo */}
        <section aria-labelledby="event-select-heading" className="rounded-2xl border border-primary/20 bg-surface p-4 shadow-lg">
          <label id="event-select-heading" className="block text-xs font-bold tracking-wider text-muted uppercase mb-1">
            Evento Atual para Carimbo
          </label>
          {events.length === 0 ? (
            <p className="text-xs text-danger">Nenhum evento ativo disponível no momento.</p>
          ) : (
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                handleReset();
              }}
              className="h-11 w-full rounded-xl border border-muted/30 bg-background px-3 text-sm font-semibold text-foreground focus:border-primary focus:outline-none"
            >
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.name} {evt.location ? `(${evt.location})` : ""}
                </option>
              ))}
            </select>
          )}
        </section>

        {/* Mensagens de Sucesso e Erro */}
        {successMessage && (
          <div
            role="status"
            className="rounded-2xl border border-success/30 bg-success/10 p-5 text-center shadow-lg animate-in zoom-in-95 duration-200"
          >
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/20 text-success">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-success">Carimbo Confirmado!</h3>
            <p className="text-xs text-muted mt-1">{successMessage}</p>
            <button
              onClick={handleReset}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-success font-bold text-white transition hover:bg-success/90 active:scale-95"
            >
              Escanear Próximo Participante
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center text-sm text-danger shadow-lg"
          >
            <p className="font-semibold">{error}</p>
            <button
              onClick={handleReset}
              className="mt-3 rounded-xl bg-danger px-4 py-2 text-xs font-bold text-white transition hover:bg-danger/90"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Prévia da Validação do Participante */}
        {preview && !successMessage && (
          <div className="rounded-2xl border border-secondary/40 bg-surface p-5 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="border-b border-muted/10 pb-3">
              <span className="text-[10px] font-bold tracking-widest text-premium uppercase">
                Participante Identificado
              </span>
              <h2 className="text-xl font-black text-foreground">{preview.participantName}</h2>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-secondary">{preview.passportNumber}</span>
                <span className="text-xs text-muted">• {preview.programName}</span>
              </div>
            </div>

            <div className="rounded-xl bg-background/50 p-3">
              <span className="block text-[11px] text-muted uppercase">Evento Selecionado</span>
              <span className="text-sm font-bold text-foreground">{preview.eventName}</span>
            </div>

            {preview.alreadyStamped ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-center">
                <span className="text-xs font-bold text-danger">Presença Já Registrada Anteriormente!</span>
                <p className="text-[11px] text-muted mt-0.5">Este participante já possui carimbo confirmado neste evento.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-success/30 bg-success/10 p-3 text-center">
                <span className="text-xs font-bold text-success">Apto para Receber Carimbo</span>
                <p className="text-[11px] text-muted mt-0.5">Confira o nome acima com a pessoa antes de confirmar.</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleReset}
                className="h-12 flex-1 rounded-xl border border-muted/30 text-xs font-semibold text-muted hover:text-foreground transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmStamp}
                disabled={loading || preview.alreadyStamped}
                className="h-12 flex-2 rounded-xl bg-primary font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50 active:scale-95"
              >
                {loading ? "Registrando..." : "Confirmar Carimbo"}
              </button>
            </div>
          </div>
        )}

        {/* Scanner da Câmera / Validação */}
        {isScanning && !preview && !successMessage && (
          <div className="rounded-2xl border border-primary/20 bg-surface p-4 shadow-xl text-center">
            {hasCamera === false ? (
              <div className="py-6 px-4">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-foreground">Dispositivo sem Câmera Detectada</h3>
                <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
                  Nenhuma câmera/webcam foi encontrada neste computador. Para escanear com a câmera, acesse esta tela pelo celular do atendente ou valide inserindo o código abaixo.
                </p>
              </div>
            ) : hasCamera === true && !cameraDenied ? (
              <>
                <h2 className="text-xs font-bold tracking-wider text-muted uppercase mb-3">
                  Aponte a Câmera para o QR Code do Participante
                </h2>
                <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-2xl bg-black shadow-inner">
                  <Scanner
                    onScan={handleScan}
                    onError={(err) => {
                      console.warn("Scanner camera warning:", err);
                      setCameraDenied(true);
                    }}
                    components={{
                      audio: false,
                      torch: true,
                      finder: true,
                    }}
                    styles={{
                      container: { width: "100%", height: "100%" },
                    }}
                  />
                </div>
              </>
            ) : cameraDenied ? (
              <div className="py-6 px-4">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-foreground">Câmera Indisponível</h3>
                <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
                  A permissão da câmera foi negada ou o dispositivo foi desconectado. Permita o acesso nas configurações do navegador ou valide pelo código manual abaixo.
                </p>
              </div>
            ) : (
              <div className="py-8 flex items-center justify-center text-muted text-xs">
                Verificando disponibilidade da câmera...
              </div>
            )}

            {/* Fallback de Digitação/Colagem Manual */}
            <div className="mt-4 border-t border-muted/10 pt-4 text-left">
              <label className="block text-xs font-semibold text-foreground mb-1">
                Validação Manual por Código:
              </label>
              <p className="text-[11px] text-muted mb-2">
                Cole ou digite o código de 64 caracteres gerado no passaporte do participante:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Cole aqui o token do QR Code"
                  className="h-10 flex-1 rounded-xl border border-muted/30 bg-background px-3 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  className="h-10 rounded-xl border border-muted/30 px-3 text-xs font-semibold text-muted hover:text-foreground transition active:scale-95"
                  title="Colar da Área de Transferência"
                >
                  Colar
                </button>
                <button
                  type="button"
                  onClick={() => verifyToken(manualToken.trim())}
                  disabled={!manualToken.trim() || loading}
                  className="h-10 rounded-xl bg-primary px-4 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition active:scale-95"
                >
                  {loading ? "Validando..." : "Validar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
