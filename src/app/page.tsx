import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md rounded-2xl border border-primary/20 bg-surface p-8 shadow-2xl shadow-primary/10">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-2xl font-bold tracking-wider text-premium">
            JRC
          </div>
        </div>
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Passaporte de Eventos
        </h1>
        <p className="mb-8 text-sm text-muted">
          Acesso exclusivo para convidados dos eventos corporativos JRC.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-primary font-medium text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background active:scale-[0.98]"
          >
            Acessar com E-mail
          </Link>
          <p className="mt-4 text-xs text-muted/70">
            Acesso mediante convite individual de uso único.
          </p>
        </div>
      </div>
    </main>
  );
}
