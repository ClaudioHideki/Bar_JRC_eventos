"use client";

import { useState } from "react";
import Link from "next/link";

export function ResetPasswordClient({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (password !== confirmation) { setError("As senhas não conferem."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password-recovery/complete", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível trocar a senha.");
      setDone(true);
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "Erro ao trocar senha."); }
    finally { setLoading(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground"><div className="w-full max-w-md space-y-5 rounded-3xl border border-primary/20 bg-surface p-8 shadow-xl">
    <h1 className="text-2xl font-black">Definir nova senha</h1>
    {done ? <><p role="status" className="text-sm text-success">Senha atualizada. Entre com a nova senha.</p><Link href="/login" className="block rounded-xl bg-primary p-3 text-center font-bold text-white">Ir para o login</Link></> : <form onSubmit={submit} className="space-y-4">
      <label className="block text-xs font-bold">Nova senha
        <input type="password" minLength={8} maxLength={128} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-muted/30 bg-background px-4 py-3 text-sm" />
      </label>
      <label className="block text-xs font-bold">Confirmar senha
        <input type="password" minLength={8} maxLength={128} required autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1 w-full rounded-xl border border-muted/30 bg-background px-4 py-3 text-sm" />
      </label>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <button disabled={loading} className="w-full rounded-xl bg-primary p-3 text-sm font-bold text-white disabled:opacity-50">{loading ? "Salvando..." : "Salvar nova senha"}</button>
    </form>}
  </div></main>;
}
