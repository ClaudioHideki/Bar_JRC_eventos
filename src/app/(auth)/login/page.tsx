"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectAfterLogin = async (userRole?: string) => {
    let role = userRole;

    if (!role) {
      const session = await authClient.getSession();
      role = (session?.data?.user as { role?: string })?.role;
    }

    if (role === "ADMIN") {
      window.location.href = "/admin";
    } else if (role === "ATTENDANT") {
      window.location.href = "/atendimento";
    } else {
      window.location.href = "/passaporte";
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
      });

      if (res.error) {
        setError(res.error.message || "E-mail ou senha inválidos.");
        setLoading(false);
        return;
      }

      const role = (res.data?.user as { role?: string })?.role;
      await redirectAfterLogin(role);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao realizar login."
      );
      setLoading(false);
    }
  };

  const fillLocalAccount = (
    accountEmail: string,
    accountPassword: string
  ) => {
    setEmail(accountEmail);
    setPassword(accountPassword);
    setError(null);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground py-10">
      <div className="w-full max-w-md rounded-3xl border border-primary/20 bg-surface p-8 shadow-2xl shadow-primary/10">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-2xl font-bold tracking-wider text-premium border border-primary/30">
            JRC
          </div>

          <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground">
            Acesso ao Passaporte
          </h1>

          <p className="mt-1 text-xs text-muted">
            Entre com seu e-mail e sua senha.
          </p>
        </div>

        {typeof window !== "undefined" &&
          (window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1") && (
            <div className="mb-6 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted text-center mb-1.5">
                Acesso de Teste (Modo Local):
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    fillLocalAccount(
                      "admin@jrc.com.br",
                      "admin123"
                    )
                  }
                  disabled={loading}
                  className="flex flex-col items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 p-3 hover:bg-primary/20 transition active:scale-95 text-center cursor-pointer"
                >
                  <span className="text-lg">🛡️</span>

                  <span className="text-xs font-bold text-foreground mt-1">
                    Administrador
                  </span>

                  <span className="text-[10px] text-premium font-mono">
                    admin@jrc.com.br
                  </span>

                  <span className="text-[9px] text-muted">
                    senha: admin123
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    fillLocalAccount(
                      "atendente@jrc.com.br",
                      "atendente123"
                    )
                  }
                  disabled={loading}
                  className="flex flex-col items-center justify-center rounded-2xl border border-secondary/40 bg-secondary/10 p-3 hover:bg-secondary/20 transition active:scale-95 text-center cursor-pointer"
                >
                  <span className="text-lg">📱</span>

                  <span className="text-xs font-bold text-foreground mt-1">
                    Atendente
                  </span>

                  <span className="text-[10px] text-secondary font-mono">
                    atendente@jrc.com.br
                  </span>

                  <span className="text-[9px] text-muted">
                    senha: atendente123
                  </span>
                </button>
              </div>
            </div>
          )}

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger text-center font-medium"
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handlePasswordLogin}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1"
            >
              E-mail
            </label>

            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@exemplo.com.br"
              className="h-11 w-full rounded-xl border border-muted/30 bg-background px-4 text-sm text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1"
            >
              Senha
            </label>

            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              className="h-11 w-full rounded-xl border border-muted/30 bg-background px-4 text-sm text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-primary font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? "Entrando..." : "Entrar no Passaporte"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-muted/20 text-center space-y-2">
          <p className="text-xs text-muted">
            Primeira vez no Bar JRC?
          </p>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted text-center leading-relaxed">
            O Passaporte Digital é exclusivo para convidados. Utilize o link
            exclusivo recebido via WhatsApp para criar sua conta e ativar seu
            passaporte.
          </div>
        </div>
      </div>
    </main>
  );
}