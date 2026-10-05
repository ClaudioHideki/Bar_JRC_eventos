"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WHEEL_AMOUNTS_CENTS } from "@/lib/domain/wheel";

type Prize = { amountCents: number; weight: number; limit: number; awardedCount: number };
type State = { prizes: Prize[] };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);

export default function WheelClient() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/wheel", { credentials: "include", cache: "no-store" });
    if (response.status === 401) setExpired(true);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Não foi possível carregar a roleta.");
    setState(body);
  }
  useEffect(() => { load().catch((cause) => setError(cause.message)); }, []);

  async function spin() {
    if (spinning) return;
    setSpinning(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/admin/wheel/spin", { method: "POST", credentials: "include" });
      if (response.status === 401) setExpired(true);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível girar.");
      const sector = WHEEL_AMOUNTS_CENTS.indexOf(body.amountCents);
      if (sector < 0) throw new Error("Resultado inesperado. Confira o histórico nos Ajustes.");
      const next = rotation + 360 * 6 + ((360 - ((rotation + sector * 72) % 360)) % 360);
      setRotation(next);
      await new Promise((resolve) => window.setTimeout(resolve, 4300));
      setResult(body.amountCents);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao girar."); }
    finally { setSpinning(false); }
  }

  const availableWeight = state?.prizes.reduce((sum, prize) => sum + (prize.awardedCount < prize.limit ? prize.weight : 0), 0) || 0;

  return <div className="mx-auto max-w-3xl space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-bold">Roleta do Bar JRC</h1><p className="mt-2 text-sm text-muted">Pronta para o sorteio.</p></div>
      <Link href="/admin/roleta/ajustes" className="rounded-xl border border-white/20 px-4 py-2 text-sm text-muted hover:text-foreground">Ajustes</Link>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-500/50 p-4 text-red-300">{error} {expired && <Link className="underline" href="/login">Entrar novamente</Link>}</div>}
    <section className="rounded-2xl border border-white/20 bg-surface p-5 text-center sm:p-8">
      <div className="relative mx-auto max-w-[540px] rounded-2xl bg-white p-5 shadow-inner sm:p-8">
        <div className="absolute left-1/2 top-5 z-10 -translate-x-1/2 -translate-y-2 border-x-[14px] border-x-transparent border-t-[30px] border-t-premium sm:top-8" aria-hidden="true" />
        <img src="/brand/roleta-jrc.png" alt="Roleta Bar JRC com cinco prêmios" className="w-full rounded-full" style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 4.2s cubic-bezier(.13,.8,.12,1)" : "none" }} />
      </div>
      <button type="button" onClick={spin} disabled={spinning || availableWeight === 0} className="mt-6 rounded-xl bg-primary px-8 py-3 font-bold text-white disabled:opacity-50">{spinning ? "Girando..." : "Girar roleta"}</button>
      {result !== null && <p role="status" className="mt-5 text-2xl font-bold text-premium">Prêmio sorteado: {money(result)}</p>}
      {state && availableWeight === 0 && <p className="mt-4 text-sm text-muted">Nenhum prêmio disponível. Configure chances e limites em Ajustes.</p>}
    </section>
  </div>;
}
