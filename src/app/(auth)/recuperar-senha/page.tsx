"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function RequestRecoveryPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [devUrl, setDevUrl] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"ADMIN_MANUAL" | "EMAIL" | "DEVELOPMENT" | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/password-recovery/request", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => { if (active) setDeliveryMode(body.mode === "EMAIL" || body.mode === "DEVELOPMENT" ? body.mode : "ADMIN_MANUAL"); })
      .catch(() => { if (active) setDeliveryMode("ADMIN_MANUAL"); });
    return () => { active = false; };
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError(""); setMessage(""); setDevUrl("");
    try {
      const response = await fetch("/api/auth/password-recovery/request", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Tente novamente mais tarde.");
      setMessage(body.message);
      setDevUrl(body.devResetUrl || "");
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "Erro ao solicitar recuperação."); }
    finally { setLoading(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
    <div className="w-full max-w-md space-y-5 rounded-3xl border border-primary/20 bg-surface p-8 shadow-xl">
      <h1 className="text-2xl font-black">Recuperar acesso</h1>
      {deliveryMode === "ADMIN_MANUAL" && <p role="status" className="text-sm leading-relaxed text-muted">
        A recuperação é feita pela equipe JRC. Peça ao administrador um link pessoal pelo WhatsApp cadastrado.
        Ele enviará a mensagem manualmente; sua senha atual não será enviada.
      </p>}
      {deliveryMode === null && <p className="text-sm text-muted">Verificando como recuperar seu acesso...</p>}
      {(deliveryMode === "EMAIL" || deliveryMode === "DEVELOPMENT") && <>
      <p className="text-sm text-muted">Informe o WhatsApp cadastrado para receber um link temporário no e-mail da sua conta.</p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs font-bold">WhatsApp com DDD
          <input type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(11) 98765-4321"
            className="mt-1 w-full rounded-xl border border-muted/30 bg-background px-4 py-3 text-sm" />
        </label>
        <button disabled={loading} className="w-full rounded-xl bg-primary p-3 text-sm font-bold text-white disabled:opacity-50">{loading ? "Solicitando..." : "Solicitar recuperação"}</button>
      </form>
      </>}
      {message && <p role="status" className="text-sm text-success">{message}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {devUrl && <Link href={devUrl} className="block text-sm text-premium underline">Abrir link de teste local</Link>}
      <Link href="/login" className="block text-center text-xs text-muted underline">Voltar ao login</Link>
    </div>
  </main>;
}
