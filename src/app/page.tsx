import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background text-foreground">
      <div className="w-full max-w-md rounded-3xl border border-primary/30 bg-surface/90 p-8 shadow-2xl shadow-primary/20 backdrop-blur">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-2xl font-black tracking-wider text-premium border border-primary/30">
            JRC
          </div>
        </div>
        <span className="text-[10px] font-bold tracking-[0.25em] text-premium uppercase">
          JRC Construtora 40 Anos
        </span>
        <h1 className="mt-1 mb-2 text-3xl font-black tracking-tight text-foreground">
          Passaporte Bar JRC
        </h1>
        <p className="mb-6 text-xs leading-relaxed text-muted">
          Complete os doze carimbos do seu passaporte, um a cada <strong>Bar JRC mensal</strong>, e garanta o direito de escolher o tema do último encontro do ano.
        </p>

        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs text-muted">
            <p className="font-bold text-foreground mb-1">Recebeu um convite oficial?</p>
            <p className="text-[11px] leading-relaxed">
              Acesse o link exclusivo enviado pela equipe JRC (via WhatsApp ou e-mail) para ativar seu passaporte digital.
            </p>
          </div>
          <Link
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-primary to-secondary font-bold text-white shadow-lg shadow-primary/25 transition hover:opacity-95 active:scale-[0.98] text-sm"
          >
            Já Possuo Passaporte (Entrar)
          </Link>
          <p className="mt-4 text-[11px] text-muted/70">
            Dezembro é seu. Se você estiver lá até o fim.
          </p>
        </div>
      </div>
    </main>
  );
}
