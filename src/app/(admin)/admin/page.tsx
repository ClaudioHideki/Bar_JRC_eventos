import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getOrCreateDefaultProgram } from "@/lib/domain/invitations";
import { InvitationStatus, StampStatus, EventStatus } from "@prisma/client";

export default async function AdminDashboardPage() {
  const program = await getOrCreateDefaultProgram();

  const [
    availableInvites,
    sentInvites,
    usedInvites,
    expiredInvites,
    revokedInvites,
    activeParticipants,
    totalEvents,
    activeEvents,
    confirmedStamps,
  ] = await Promise.all([
    prisma.invitation.count({ where: { programId: program.id, status: InvitationStatus.AVAILABLE } }),
    prisma.invitation.count({ where: { programId: program.id, status: InvitationStatus.SENT } }),
    prisma.invitation.count({ where: { programId: program.id, status: InvitationStatus.USED } }),
    prisma.invitation.count({ where: { programId: program.id, status: InvitationStatus.EXPIRED } }),
    prisma.invitation.count({ where: { programId: program.id, status: InvitationStatus.REVOKED } }),
    prisma.passport.count({ where: { programId: program.id, status: "ACTIVE" } }),
    prisma.event.count({ where: { programId: program.id } }),
    prisma.event.count({ where: { programId: program.id, status: EventStatus.ACTIVE } }),
    prisma.stamp.count({ where: { status: StampStatus.CONFIRMED } }),
  ]);

  const averageAttendance =
    activeParticipants > 0 ? (confirmedStamps / activeParticipants).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      {/* Título e Visão Geral */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Painel Executivo — {program.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Acompanhamento em tempo real de convites, ativações e presenças dos 30 participantes convidados.
        </p>
      </div>

      {/* Grid de Métricas Principais */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Capacidade do Programa */}
        <div className="rounded-2xl border border-primary/20 bg-surface p-4 shadow-lg">
          <span className="text-xs text-muted uppercase font-semibold">Capacidade Total</span>
          <p className="mt-2 text-3xl font-black text-premium">{program.capacity}</p>
          <span className="text-[11px] text-muted">Vagas exclusivas</span>
        </div>

        {/* Participantes Ativos */}
        <div className="rounded-2xl border border-primary/20 bg-surface p-4 shadow-lg">
          <span className="text-xs text-muted uppercase font-semibold">Participantes Ativados</span>
          <p className="mt-2 text-3xl font-black text-success">{activeParticipants}</p>
          <span className="text-[11px] text-muted">Com passaporte digital</span>
        </div>

        {/* Total de Carimbos Confirmados */}
        <div className="rounded-2xl border border-primary/20 bg-surface p-4 shadow-lg">
          <span className="text-xs text-muted uppercase font-semibold">Carimbos Aplicados</span>
          <p className="mt-2 text-3xl font-black text-secondary">{confirmedStamps}</p>
          <span className="text-[11px] text-muted">Presenças confirmadas</span>
        </div>

        {/* Participação Média */}
        <div className="rounded-2xl border border-primary/20 bg-surface p-4 shadow-lg">
          <span className="text-xs text-muted uppercase font-semibold">Média por Convidado</span>
          <p className="mt-2 text-3xl font-black text-foreground">{averageAttendance}</p>
          <span className="text-[11px] text-muted">Eventos por participante</span>
        </div>
      </div>

      {/* Detalhamento do Funil dos 30 Convites */}
      <section aria-labelledby="funnel-heading" className="rounded-3xl border border-primary/20 bg-surface p-6 shadow-xl space-y-4">
        <h2 id="funnel-heading" className="text-base font-bold text-foreground">
          Gestão de Convites do Programa (Teto Máximo: 30)
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 text-center">
          <div className="rounded-xl bg-background/50 p-3 border border-muted/10">
            <span className="text-xs text-muted">Disponíveis</span>
            <p className="text-xl font-bold text-foreground mt-1">{availableInvites}</p>
          </div>
          <div className="rounded-xl bg-background/50 p-3 border border-muted/10">
            <span className="text-xs text-secondary">Enviados</span>
            <p className="text-xl font-bold text-secondary mt-1">{sentInvites}</p>
          </div>
          <div className="rounded-xl bg-background/50 p-3 border border-muted/10">
            <span className="text-xs text-success">Utilizados</span>
            <p className="text-xl font-bold text-success mt-1">{usedInvites}</p>
          </div>
          <div className="rounded-xl bg-background/50 p-3 border border-muted/10">
            <span className="text-xs text-muted/50">Expirados</span>
            <p className="text-xl font-bold text-muted/50 mt-1">{expiredInvites}</p>
          </div>
          <div className="rounded-xl bg-background/50 p-3 border border-muted/10">
            <span className="text-xs text-danger">Revogados</span>
            <p className="text-xl font-bold text-danger mt-1">{revokedInvites}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/admin/convites"
            className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-primary/90 transition"
          >
            Gerenciar Links e Envio de Convites
          </Link>
          <Link
            href="/admin/eventos"
            className="rounded-xl border border-muted/30 px-4 py-2.5 text-xs font-bold text-muted hover:text-foreground transition"
          >
            Eventos ({activeEvents} ativos de {totalEvents})
          </Link>
          <Link
            href="/api/admin/export"
            className="rounded-xl border border-secondary/40 bg-secondary/10 px-4 py-2.5 text-xs font-bold text-secondary hover:bg-secondary/20 transition"
          >
            Baixar Relatório em CSV Protegido
          </Link>
        </div>
      </section>
    </div>
  );
}
