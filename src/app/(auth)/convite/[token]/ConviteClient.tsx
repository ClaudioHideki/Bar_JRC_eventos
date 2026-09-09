"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function ConviteClient({
  token,
  initialName = "",
  initialEmail = "",
  tokenStatus,
}: {
  token: string;
  initialName?: string;
  initialEmail?: string;
  tokenStatus?: "VALID" | "USED" | "INVALID" | "EXPIRED";
}) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [realEstateAgency, setRealEstateAgency] = useState("");
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [showLgpdModal, setShowLgpdModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!lgpdAccepted) {
      setError("É obrigatório concordar com o Termo de Consentimento LGPD e Regulamento.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/invitation/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          name,
          email,
          password,
          realEstateAgency,
          lgpdConsent: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Erro ao ativar passaporte.");
      }

      setSuccess("Passaporte digital ativado com sucesso! Redirecionando...");
      setTimeout(() => {
        window.location.href = "/passaporte";
      }, 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao processar ativação do convite.");
    } finally {
      setLoading(false);
    }
  };

  // Se o token já foi utilizado
  if (tokenStatus === "USED") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground py-10">
        <div className="w-full max-w-md rounded-3xl border border-primary/30 bg-surface p-8 shadow-2xl shadow-primary/15 text-center space-y-4">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-secondary/20 text-2xl font-black text-secondary border border-secondary/30">
            ✓
          </div>
          <h1 className="text-xl font-black text-foreground">Convite Já Utilizado</h1>
          <p className="text-xs text-muted leading-relaxed">
            Este link de convite já foi utilizado para ativar um passaporte digital do Bar JRC.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-primary to-secondary font-bold text-white shadow-lg transition hover:opacity-95 text-sm"
            >
              Fazer Login no Meu Passaporte
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Se o token é inválido ou inexistente
  if (tokenStatus === "INVALID") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground py-10">
        <div className="w-full max-w-md rounded-3xl border border-danger/30 bg-surface p-8 shadow-2xl text-center space-y-4">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-danger/20 text-2xl font-black text-danger border border-danger/30">
            ✕
          </div>
          <h1 className="text-xl font-black text-foreground">Convite Não Encontrado</h1>
          <p className="text-xs text-muted leading-relaxed">
            O link informado é inválido ou não existe. Verifique se o link foi copiado integralmente ou solicite um novo convite com a equipe JRC.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-muted/30 px-5 text-xs text-muted hover:text-foreground transition"
            >
              Ir para Tela de Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground py-10">
      <div className="w-full max-w-md rounded-3xl border border-primary/30 bg-surface p-8 shadow-2xl shadow-primary/15">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-2xl font-black tracking-wider text-premium border border-primary/30">
            JRC
          </div>
          <span className="mt-3 inline-block rounded-full bg-premium/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-premium border border-premium/30">
            Convite Oficial Exclusivo
          </span>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground">
            Ativação de Passaporte
          </h1>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            Programa de Fidelidade Bar JRC 40 Anos. Complete os 12 carimbos mensais e escolha o tema do encerramento de Dezembro.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger text-center font-medium"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-secondary/30 bg-secondary/10 p-3 text-xs text-secondary text-center font-bold"
          >
            {success}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
              Nome Completo *
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carlos Eduardo Silva"
              className="h-11 w-full rounded-xl border border-muted/30 bg-background px-4 text-sm text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
              Seu E-mail *
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.nome@empresa.com.br"
              className="h-11 w-full rounded-xl border border-muted/30 bg-background px-4 text-sm text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Senha de Acesso *
              </label>
              <span className="text-[10px] text-premium font-medium">
                💡 Sugestão: Data de Nascimento
              </span>
            </div>
            <input
              id="password"
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ex: 15/08/1990 ou senha de sua escolha"
              className="h-11 w-full rounded-xl border border-muted/30 bg-background px-4 text-sm text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-[11px] text-muted/70 mt-1">
              Dica: Usar sua data de nascimento facilita lembrar o acesso nos próximos eventos mensais.
            </p>
          </div>

          <div>
            <label htmlFor="agency" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
              Imobiliária Vinculada *
            </label>
            <input
              id="agency"
              type="text"
              required
              value={realEstateAgency}
              onChange={(e) => setRealEstateAgency(e.target.value)}
              placeholder="Ex: Imobiliária Central / Corretor Parceiro"
              className="h-11 w-full rounded-xl border border-muted/30 bg-background px-4 text-sm text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Checkbox LGPD */}
          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer text-xs text-muted select-none">
              <input
                type="checkbox"
                required
                checked={lgpdAccepted}
                onChange={(e) => setLgpdAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-muted/40 bg-background text-primary focus:ring-primary focus:ring-offset-background"
              />
              <span>
                Li e concordo com os{" "}
                <button
                  type="button"
                  onClick={() => setShowLgpdModal(true)}
                  className="text-premium underline hover:text-foreground font-semibold"
                >
                  Termos de Uso e Proteção de Dados (LGPD)
                </button>{" "}
                e com o Regulamento da Campanha Passaporte Bar JRC 40 Anos.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !lgpdAccepted}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-primary to-secondary font-bold text-white shadow-lg shadow-primary/25 transition hover:opacity-95 disabled:opacity-50 active:scale-[0.98] mt-2 cursor-pointer"
          >
            {loading ? "Ativando Passaporte..." : "Ativar Meu Passaporte Digital"}
          </button>

          <div className="text-center pt-2">
            <p className="text-xs text-muted">
              Já possui conta cadastrada?{" "}
              <Link href="/login" className="font-bold text-premium hover:underline">
                Acessar Passaporte
              </Link>
            </p>
          </div>
        </form>
      </div>

      {/* Modal Termo de Consentimento LGPD */}
      {showLgpdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-primary/30 bg-surface p-6 shadow-2xl text-foreground">
            <div className="flex items-center justify-between pb-4 border-b border-muted/20">
              <h2 className="text-lg font-bold text-premium">
                Termo de Consentimento e Privacidade (LGPD)
              </h2>
              <button
                type="button"
                onClick={() => setShowLgpdModal(false)}
                className="rounded-lg p-1 text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted">
              <p>
                <strong>1. Finalidade do Tratamento:</strong> Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você autoriza a JRC Construtora a coletar e tratar os dados informados (Nome, E-mail, Senha/Data de Nascimento e Imobiliária Vinculada) com as seguintes finalidades exclusivas:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Identificação e emissão do seu Passaporte Digital de Eventos JRC;</li>
                <li>Validação e registro de presenças nos encontros mensais do Bar JRC;</li>
                <li>Contagem oficial de carimbos para apuração dos participantes aptos a escolher o tema do encerramento anual;</li>
                <li>Comunicação sobre atualizações de eventos e novidades institucionais da JRC.</li>
              </ul>
              <p>
                <strong>2. Segurança e Não Compartilhamento:</strong> Seus dados pessoais não serão comercializados nem cedidos a terceiros alheios à operação do evento. Todas as informações trafegam sob conexões criptografadas e são armazenadas em infraestrutura protegida.
              </p>
              <p>
                <strong>3. Direitos do Titular:</strong> Você poderá, a qualquer momento, solicitar a confirmação, retificação ou revogação do consentimento junto aos canais oficiais de marketing da JRC Construtora.
              </p>
              <p>
                <strong>4. Regulamento da Campanha:</strong> A participação na campanha é voluntária. Os 12 carimbos são atribuídos presencialmente pela recepção do Bar JRC. Carimbos são pessoais e intransferíveis.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setLgpdAccepted(true);
                  setShowLgpdModal(false);
                }}
                className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary/90 transition cursor-pointer"
              >
                Li e Concordo com os Termos
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
