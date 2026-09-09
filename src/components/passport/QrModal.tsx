"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QrModal({ isOpen, onClose }: QrModalProps) {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNewQr = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/qr/challenge", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao gerar QR Code");
      }

      setToken(data.token);

      // Gera o DataURL em fundo branco com quiet zone de 2 blocos para leitura ótica perfeita
      const url = await QRCode.toDataURL(data.token, {
        width: 320,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });

      setQrDataUrl(url);
      setSecondsRemaining(300);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar QR Code.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNewQr();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || secondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, secondsRemaining]);

  if (!isOpen) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full max-w-sm rounded-3xl border border-primary/30 bg-surface p-6 text-center shadow-2xl">
        <h2 id="qr-modal-title" className="text-xl font-bold text-foreground">
          Apresente para Carimbo
        </h2>
        <p className="mt-1 text-xs text-muted">
          Aproxime da câmera do atendente oficial do evento.
        </p>

        <div className="my-6 flex flex-col items-center justify-center">
          {loading ? (
            <div className="flex h-64 w-64 items-center justify-center rounded-2xl bg-white/5 text-muted">
              <span className="text-sm">Gerando código seguro...</span>
            </div>
          ) : error ? (
            <div className="flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border border-danger/30 bg-danger/10 p-5 text-center text-danger">
              <p className="text-xs font-bold mb-1">{error}</p>
              {error.toLowerCase().includes("participante") && (
                <p className="text-[11px] text-muted my-2 leading-relaxed">
                  Você está conectado com uma conta de Atendente ou Administrador neste navegador. Faça login com o seu usuário de participante para gerar o QR Code.
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={fetchNewQr}
                  className="rounded-xl bg-danger px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger/90 transition"
                >
                  Tentar novamente
                </button>
                {error.toLowerCase().includes("participante") && (
                  <a
                    href="/login"
                    className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition"
                  >
                    Entrar como Participante
                  </a>
                )}
              </div>
            </div>
          ) : qrDataUrl ? (
            <div className="relative rounded-2xl bg-white p-3 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR Code temporário de uso único"
                className="h-64 w-64 rounded-xl"
              />
              {secondsRemaining === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/80 p-4 text-white">
                  <p className="mb-2 text-sm font-semibold">Código expirado</p>
                  <button
                    onClick={fetchNewQr}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90"
                  >
                    Gerar Novo Código
                  </button>
                </div>
              )}
            </div>
          ) : null}

          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-muted">Válido por:</span>
            <span
              aria-live="polite"
              className={`text-sm font-mono font-bold ${secondsRemaining < 60 ? "text-danger" : "text-secondary"}`}
            >
              {formattedTime}
            </span>
          </div>

          <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-background">
            <div
              className="h-full bg-secondary transition-all duration-1000"
              style={{ width: `${(secondsRemaining / 300) * 100}%` }}
            />
          </div>

          {token && (
            <div className="mt-3 flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(token);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  } catch {
                    // Fallback se não conseguir copiar
                  }
                }}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition underline underline-offset-4 font-medium"
              >
                {copied ? (
                  <span className="text-success font-bold">✓ Código copiado para validação!</span>
                ) : (
                  <span>📋 Copiar código para validação manual</span>
                )}
              </button>
              <p className="text-[10px] text-muted max-w-[260px] text-center">
                Útil para validar quando o atendente estiver no computador ou caso a câmera não consiga ler.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={fetchNewQr}
            disabled={loading}
            className="h-11 w-full rounded-xl border border-primary/40 bg-primary/10 text-xs font-semibold text-foreground hover:bg-primary/20 transition active:scale-[0.98]"
          >
            Atualizar Código
          </button>
          <button
            onClick={onClose}
            className="h-11 w-full rounded-xl bg-surface border border-muted/20 text-xs font-semibold text-muted hover:text-foreground transition active:scale-[0.98]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
