import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getParticipantPassport, getProgramEvents, getProgramUpcomingEvents } from "@/lib/domain/passport";
import { PassportClient } from "@/components/passport/PassportClient";
import { UserRole } from "@prisma/client";

export default async function PassportPage() {
  const session = await getServerSession();
  if (!session || !session.user) {
    redirect("/login");
  }

  // Redireciona usuários não participantes para seus devidos módulos
  if (session.user.role === UserRole.ADMIN) {
    redirect("/admin");
  } else if (session.user.role === UserRole.ATTENDANT) {
    redirect("/atendimento");
  }

  // IDOR Protection: obtém passaporte estritamente do userId da sessão validada
  const passport = await getParticipantPassport(session.user.id);
  if (!passport) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background text-foreground">
        <div className="max-w-md rounded-2xl border border-danger/30 bg-surface p-8 shadow-xl">
          <h1 className="text-xl font-bold text-danger">Passaporte Não Encontrado</h1>
          <p className="mt-2 text-sm text-muted">
            Sua conta de participante não possui um passaporte ativo vinculado. Entre em contato com a equipe de marketing ou realize o cadastro na recepção.
          </p>
        </div>
      </main>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      image: true,
      realEstateAgency: true,
    },
  });

  const allEvents = await getProgramEvents(passport.programId);
  const upcomingEvents = await getProgramUpcomingEvents(passport.programId);

  // Identifica evento ativo com arte personalizada (se houver)
  const activeEventWithTheme =
    upcomingEvents.find((e) => e.themeImageUrl) ||
    allEvents.find((e) => e.status === "ACTIVE" && e.themeImageUrl);

  return (
    <PassportClient
      userName={user?.name || session.user.name}
      userEmail={user?.email || session.user.email}
      userImage={user?.image || null}
      realEstateAgency={user?.realEstateAgency || null}
      passportNumber={passport.passportNumber}
      programName={passport.program.name}
      themeImageUrl={passport.program.themeImageUrl || "/brand/passaporte-template.jpg"}
      activeEventThemeUrl={activeEventWithTheme?.themeImageUrl || null}
      activeEventName={activeEventWithTheme?.name || null}
      events={allEvents.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        orderIndex: e.orderIndex,
        startDate: e.startDate.toISOString(),
        themeImageUrl: e.themeImageUrl,
      }))}
      stamps={passport.stamps.map((s) => ({
        id: s.id,
        eventId: s.eventId,
        stampedAt: s.stampedAt.toISOString(),
        event: {
          name: s.event.name,
          description: s.event.description,
          stampColor: s.event.stampColor,
        },
      }))}
      upcomingEvents={upcomingEvents.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        startDate: e.startDate.toISOString(),
        location: e.location,
        themeImageUrl: e.themeImageUrl,
      }))}
    />
  );
}
