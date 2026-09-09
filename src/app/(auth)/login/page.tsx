"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

export default function LoginPage() {
  const router = useRouter();
  const [loginMethod, setLoginMethod] = useState<"PASSWORD" | "OTP">("PASSWORD");

  // Campos
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState<"EMAIL" | "OTP">("EMAIL");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);

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

  // Login de Administrador ou Atendente em 1 clique
  const handleRoleQuickLogin = async (role: "ADMIN" | "ATTENDANT") => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/quick-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao autenticar perfil.");
      }

      window.location.href = data.redirectPath;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
      setLoading(false);
    }
  };

  // Login por Senha / Data de Nascimento (Participantes e Administradores)
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      if (res.error) {
        setError(res.error.message || "E-mail ou senha inválidos.");
        setLoading(false);
        return;
      }

      const role = (res.data?.user as { role?: string })?.role;
      await redirectAfterLogin(role);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao realizar login.");
      setLoading(false);
    }
  };

  // Enviar OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setDevOtp(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      await authClient.emailOtp.sendVerificationOtp({
        email: cleanEmail,
        type: "sign-in",
      });

      setOtpStep("OTP");
      setMessage("Se o e-mail estiver cadastrado, você receberá um código de 6 dígitos.");

      try {
        const testRes = await fetch(`/api/test-otp?email=${encodeURIComponent(cleanEmail)}`);
        if (testRes.ok) {
          const data = await testRes.json();
          if (data.otp) {
            setDevOtp(data.otp);
          }
        }
      } catch {
        // Fallback silencioso
      }
    } catch {
      setOtpStep("OTP");
      setMessage("Se o e-mail estiver cadastrado, você receberá um código de 6 dígitos.");
    } finally {
      setLoading(false);
    }
  };

  // Validar OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authClient.signIn.emailOtp({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      });

      if (res.error) {
        setError(res.error.message || "Código inválido ou expirado.");
        return;
      }

      await redirectAfterLogin();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao validar código.");
    } finally {
      setLoading(false);
    }
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
            {loginMethod === "PASSWORD"
              ? "Entre com seu e-mail e sua senha ou data de nascimento."
              : "Receba um código de uso único por e-mail."}
          </p>
        </div>

        {/* Botões de Acesso Direto para Gestão e Recepção (Apenas em Desenvolvimento) */}
        {typeof window !== "undefined" &&
          (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && (
            <div className="mb-6 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted text-center mb-1.5">
                Acesso de Teste (Modo Local):
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleRoleQuickLogin("ADMIN")}
                  disabled={loading}
                  className="flex flex-col items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 p-3 hover:bg-primary/20 transition active:scale-95 text-center cursor-pointer"
                >
                  <span className="text-lg">🛡️</span>
                  <span className="text-xs font-bold text-foreground mt-1">Administrador</span>
                  <span className="text-[10px] text-premium font-mono">admin@jrc.com</span>
                  <span className="text-[9px] text-muted">senha: admin123</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleQuickLogin("ATTENDANT")}
                  disabled={loading}
                  className="flex flex-col items-center justify-center rounded-2xl border border-secondary/40 bg-secondary/10 p-3 hover:bg-secondary/20 transition active:scale-95 text-center cursor-pointer"
                >
                  <span className="text-lg">📱</span>
                  <span className="text-xs font-bold text-foreground mt-1">Atendente</span>
                  <span className="text-[10px] text-secondary font-mono">atendente@jrc.com</span>
                  <span className="text-[9px] text-muted">senha: atendente123</span>
                </button>
              </div>
            </div>
          )}

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-muted/20"></div>
          <span className="flex-shrink mx-3 text-[11px] font-semibold text-muted uppercase tracking-wider">
            Ou acesse com E-mail e Senha
          </span>
          <div className="flex-grow border-t border-muted/20"></div>
        </div>

        {/* Alternador de Método de Login */}
        <div className="my-4 flex rounded-xl bg-background p-1 border border-muted/20 text-xs">
          <button
            type="button"
            onClick={() => {
              setLoginMethod("PASSWORD");
              setError(null);
              setMessage(null);
            }}
            className={`flex-1 rounded-lg py-2 font-bold transition ${
              loginMethod === "PASSWORD"
                ? "bg-primary text-white shadow"
                : "text-muted hover:text-foreground"
            }`}
          >
            Senha / Nascimento
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMethod("OTP");
              setError(null);
              setMessage(null);
            }}
            className={`flex-1 rounded-lg py-2 font-bold transition ${
              loginMethod === "OTP"
                ? "bg-primary text-white shadow"
                : "text-muted hover:text-foreground"
            }`}
          >
            Código por E-mail
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger text-center font-medium"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-secondary/30 bg-secondary/10 p-3 text-xs text-secondary text-center font-medium"
          >
            {message}
          </div>
        )}

        {loginMethod === "PASSWORD" ? (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com.br"
                className="h-11 w-full rounded-xl border border-muted/30 bg-background px-4 text-sm text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                  Senha / Data de Nascimento
                </label>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha ou data cadastrada"
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
        ) : (
          <div>
            {otpStep === "EMAIL" ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label htmlFor="otp-email" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    E-mail cadastrado
                  </label>
                  <input
                    id="otp-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com.br"
                    className="h-11 w-full rounded-xl border border-muted/30 bg-background px-4 text-sm text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-primary font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50 active:scale-[0.98]"
                >
                  {loading ? "Enviando código..." : "Receber Código OTP"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {devOtp && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-center text-xs text-amber-300">
                    <div className="font-semibold uppercase tracking-wider text-amber-400">💡 Modo Local / Demonstração</div>
                    <div className="my-1.5 text-2xl font-mono font-bold tracking-widest text-amber-300">{devOtp}</div>
                    <button
                      type="button"
                      onClick={() => setOtp(devOtp)}
                      className="text-[11px] rounded-lg bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1 font-medium border border-amber-500/40 transition text-amber-200"
                    >
                      Preencher automaticamente
                    </button>
                  </div>
                )}

                <div>
                  <label htmlFor="otp" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1 text-center">
                    Código de 6 dígitos
                  </label>
                  <input
                    id="otp"
                    type="text"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="h-12 w-full text-center tracking-[0.5em] text-2xl font-bold rounded-xl border border-muted/30 bg-background px-4 text-foreground placeholder:text-muted/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-primary font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50 active:scale-[0.98]"
                >
                  {loading ? "Validando..." : "Confirmar e Entrar"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOtpStep("EMAIL");
                    setOtp("");
                    setDevOtp(null);
                  }}
                  className="w-full text-center text-xs text-muted hover:text-foreground transition pt-1"
                >
                  Informar outro e-mail
                </button>
              </form>
            )}
          </div>
        )}

        {/* Aviso de Exclusividade por Convite */}
        <div className="mt-6 pt-5 border-t border-muted/20 text-center space-y-2">
          <p className="text-xs text-muted">
            Primeira vez no Bar JRC?
          </p>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted text-center leading-relaxed">
            O Passaporte Digital é exclusivo para convidados. Utilize o link exclusivo recebido via WhatsApp ou e-mail para ativar seu passaporte.
          </div>
        </div>
      </div>
    </main>
  );
}
