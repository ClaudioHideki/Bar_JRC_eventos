"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WHEEL_AMOUNTS_CENTS } from "@/lib/domain/wheel";

type Prize = { amountCents: number; weight: number; limit: number; awardedCount: number };
type History = { id: string; amountCents: number; createdAt: string; admin: { name: string } | null };
type State = { prizes: Prize[]; history: History[] };

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);

export default function WheelClient() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
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

  function update(index: number, field: "weight" | "limit", value: string) {
    setState((current) => current && ({ ...current, prizes: current.prizes.map((prize, position) => position === index ? { ...prize, [field]: Number(value) } : prize) }));
  }

  async function save() {
    if (!state || busy || spinning) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/wheel", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prizes: state.prizes.map(({ amountCents, weight, limit }) => ({ amountCents, weight, limit })) }) });
      if (response.status === 401) setExpired(true);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível salvar.");
      setState(body); setNotice("Chances e limites salvos.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao salvar."); }
    finally { setBusy(false); }
  }

  async function spin() {
    if (busy || spinning) return;
    setSpinning(true); setError(""); setNotice(""); setResult(null);
    try {
      const response = await fetch("/api/admin/wheel/spin", { method: "POST", credentials: "include" });
      if (response.status === 401) setExpired(true);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível girar.");
      const sector = WHEEL_AMOUNTS_CENTS.indexOf(body.amountCents);
      if (sector < 0) throw new Error("Resultado inesperado. Confira o histórico da roleta.");
      const next = rotation + 360 * 6 + ((360 - ((rotation + sector * 72) % 360)) % 360);
      setRotation(next);
      await new Promise((resolve) => window.setTimeout(resolve, 4300));
      setResult(body.amountCents);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao girar."); }
    finally { setSpinning(false); }
  }

  const prizes = state?.prizes || [];
  const availableWeight = prizes.reduce((sum, prize) => sum + (prize.awardedCount < prize.limit ? prize.weight : 0), 0);

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Roleta do Bar JRC</h1><p className="text-muted mt-2">Uso exclusivo do administrador. Os giros não estão vinculados ao passaporte; cada prêmio sorteado consome uma unidade do limite configurado.</p></div>
    {error && <div role="alert" className="rounded-xl border border-red-500/50 p-4 text-red-300">{error} {expired && <Link className="underline" href="/login">Entrar novamente</Link>}</div>}
    {notice && <p role="status" className="text-emerald-300">{notice}</p>}
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/20 bg-surface p-6 text-center">
        <div className="relative mx-auto max-w-[440px]">
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-2 border-x-[14px] border-x-transparent border-t-[30px] border-t-premium" aria-hidden="true" />
          <img src="/brand/roleta-jrc.png" alt="Roleta Bar JRC com cinco prêmios" className="w-full rounded-full" style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 4.2s cubic-bezier(.13,.8,.12,1)" : "none" }} />
        </div>
        <button type="button" onClick={spin} disabled={busy || spinning || availableWeight === 0} className="mt-6 rounded-xl bg-primary px-8 py-3 font-bold text-white disabled:opacity-50">{spinning ? "Girando..." : "Girar roleta"}</button>
        {result !== null && <p role="status" className="mt-5 text-2xl font-bold text-premium">Prêmio sorteado: {money(result)}</p>}
        <p className="mt-4 text-xs text-muted">O sorteio considera as chances configuradas e o saldo de cada prêmio. O tamanho dos setores na arte é ilustrativo.</p>
      </section>
      <section className="rounded-2xl border border-white/20 bg-surface p-6">
        <h2 className="text-xl font-bold">Chances e limites</h2>
        <p className="my-3 text-sm text-muted">Chance 0 desativa o prêmio. Limite 0 impede novos sorteios. Alterações nunca apagam o histórico.</p>
        <div className="space-y-3">{prizes.map((prize, index) => <div key={prize.amountCents} className="grid grid-cols-[1fr_5rem_6rem] items-end gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-[1fr_6rem_7rem_7rem]">
          <div><strong>{money(prize.amountCents)}</strong><p className="text-xs text-muted">{prize.awardedCount} sorteado(s)</p></div>
          <label className="text-xs text-muted">Chance<input aria-label={`Chance de ${money(prize.amountCents)}`} type="number" min="0" max="1000" step="1" value={prize.weight} onChange={(event) => update(index, "weight", event.target.value)} className="mt-1 w-full rounded border border-white/20 bg-background px-2 py-2 text-foreground" /></label>
          <label className="text-xs text-muted">Limite<input aria-label={`Limite de ${money(prize.amountCents)}`} type="number" min={prize.awardedCount} max="100000" step="1" value={prize.limit} onChange={(event) => update(index, "limit", event.target.value)} className="mt-1 w-full rounded border border-white/20 bg-background px-2 py-2 text-foreground" /></label>
          <span className="hidden text-right text-xs text-muted sm:block">{availableWeight && prize.awardedCount < prize.limit ? `${Math.round(100 * prize.weight / availableWeight)}%` : "0%"} atual</span>
        </div>)}</div>
        <button type="button" onClick={save} disabled={busy || spinning || !state} className="mt-5 rounded-xl bg-primary px-6 py-3 font-bold text-white disabled:opacity-50">{busy ? "Salvando..." : "Salvar configuração"}</button>
      </section>
    </div>
    <section className="rounded-2xl border border-white/20 bg-surface p-6"><h2 className="text-xl font-bold">Últimos giros</h2>{!state?.history.length ? <p className="mt-3 text-muted">Nenhum giro registrado.</p> : <ul className="mt-3 divide-y divide-white/10">{state.history.map((spin) => <li key={spin.id} className="flex justify-between gap-3 py-2 text-sm"><span>{money(spin.amountCents)} · {spin.admin?.name || "Administrador"}</span><time>{new Date(spin.createdAt).toLocaleString("pt-BR")}</time></li>)}</ul>}</section>
  </div>;
}
