"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Prize = { amountCents: number; weight: number; limit: number; awardedCount: number };
type History = { id: string; amountCents: number; createdAt: string; admin: { name: string } | null };
type State = { prizes: Prize[]; history: History[] };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);

export default function WheelSettingsClient() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/wheel", { credentials: "include", cache: "no-store" });
    if (response.status === 401) setExpired(true);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Não foi possível carregar os ajustes.");
    setState(body);
  }
  useEffect(() => { load().catch((cause) => setError(cause.message)); }, []);

  function update(index: number, field: "weight" | "limit", value: string) {
    setState((current) => current && ({ ...current, prizes: current.prizes.map((prize, position) => position === index ? { ...prize, [field]: Number(value) } : prize) }));
  }

  async function save() {
    if (!state || busy) return;
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

  async function remove(mode: "ONE" | "ALL", spin?: History) {
    if (busy) return;
    const message = mode === "ALL"
      ? "Excluir todos os giros da roleta? Os prêmios voltarão aos limites disponíveis. A auditoria conservará as anulações."
      : `Excluir o giro de ${money(spin!.amountCents)}? O prêmio voltará ao limite disponível. A auditoria conservará a anulação.`;
    if (!confirm(message)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/wheel/spins", { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mode === "ALL" ? { mode } : { mode, spinId: spin!.id }) });
      if (response.status === 401) setExpired(true);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível excluir o giro.");
      setState(body); setNotice(mode === "ALL" ? "Histórico limpo e prêmios devolvidos aos limites." : "Giro excluído e prêmio devolvido ao limite.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao excluir o giro."); }
    finally { setBusy(false); }
  }

  const prizes = state?.prizes || [];
  const availableWeight = prizes.reduce((sum, prize) => sum + (prize.awardedCount < prize.limit ? prize.weight : 0), 0);

  return <div className="mx-auto max-w-4xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">Ajustes da roleta</h1><p className="mt-2 text-sm text-muted">Defina as chances e limites antes de girar.</p></div><Link href="/admin/roleta" className="rounded-xl border border-white/20 px-4 py-2 text-sm text-muted hover:text-foreground">Voltar à roleta</Link></div>
    {error && <div role="alert" className="rounded-xl border border-red-500/50 p-4 text-red-300">{error} {expired && <Link className="underline" href="/login">Entrar novamente</Link>}</div>}
    {notice && <p role="status" className="text-emerald-300">{notice}</p>}
    <section className="rounded-2xl border border-white/20 bg-surface p-6">
      <h2 className="text-xl font-bold">Chances e limites</h2>
      <p className="my-3 text-sm text-muted">Chance 0 desativa o prêmio. Limite 0 impede novos sorteios. A chance atual considera apenas prêmios disponíveis.</p>
      <div className="space-y-3">{prizes.map((prize, index) => <div key={prize.amountCents} className="grid grid-cols-[1fr_5rem_6rem] items-end gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-[1fr_6rem_7rem_7rem]">
        <div><strong>{money(prize.amountCents)}</strong><p className="text-xs text-muted">{prize.awardedCount} sorteado(s)</p></div>
        <label className="text-xs text-muted">Chance<input aria-label={`Chance de ${money(prize.amountCents)}`} type="number" min="0" max="1000" step="1" value={prize.weight} onChange={(event) => update(index, "weight", event.target.value)} className="mt-1 w-full rounded border border-white/20 bg-background px-2 py-2 text-foreground" /></label>
        <label className="text-xs text-muted">Limite<input aria-label={`Limite de ${money(prize.amountCents)}`} type="number" min={prize.awardedCount} max="100000" step="1" value={prize.limit} onChange={(event) => update(index, "limit", event.target.value)} className="mt-1 w-full rounded border border-white/20 bg-background px-2 py-2 text-foreground" /></label>
        <span className="hidden text-right text-xs text-muted sm:block">{availableWeight && prize.awardedCount < prize.limit ? `${Math.round(100 * prize.weight / availableWeight)}%` : "0%"} atual</span>
      </div>)}</div>
      <button type="button" onClick={save} disabled={busy || !state} className="mt-5 rounded-xl bg-primary px-6 py-3 font-bold text-white disabled:opacity-50">{busy ? "Salvando..." : "Salvar configuração"}</button>
    </section>
    <section className="rounded-2xl border border-white/20 bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Últimos giros</h2>{!!state?.history.length && <button type="button" onClick={() => remove("ALL")} disabled={busy} className="rounded-lg border border-red-500/50 px-3 py-2 text-xs font-semibold text-red-300 disabled:opacity-50">Excluir todos os giros</button>}</div>
      <p className="mt-2 text-xs text-muted">A exclusão devolve o prêmio ao limite disponível e mantém a anulação na auditoria.</p>
      {!state?.history.length ? <p className="mt-3 text-muted">Nenhum giro registrado.</p> : <ul className="mt-3 divide-y divide-white/10">{state.history.map((spin) => <li key={spin.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"><span>{money(spin.amountCents)} · {spin.admin?.name || "Administrador"}</span><div className="flex items-center gap-4"><time>{new Date(spin.createdAt).toLocaleString("pt-BR")}</time><button type="button" onClick={() => remove("ONE", spin)} disabled={busy} className="rounded-lg border border-red-500/50 px-2 py-1 text-xs font-semibold text-red-300 disabled:opacity-50">Excluir</button></div></li>)}</ul>}
    </section>
  </div>;
}
