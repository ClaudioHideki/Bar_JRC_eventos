import { prisma } from "@/lib/db/prisma";
import { getOrCreateDefaultProgram } from "@/lib/domain/invitations";

export default async function AdminRankingPage() {
  const program = await getOrCreateDefaultProgram();

  // Busca todos os passaportes com seus carimbos confirmados
  const passports = await prisma.passport.findMany({
    where: { programId: program.id, status: "ACTIVE" },
    include: {
      user: true,
      stamps: {
        where: { status: "CONFIRMED" },
        orderBy: { stampedAt: "desc" },
      },
    },
  });

  // Ordenação de negócio estrita:
  // 1. Total de eventos confirmados desc
  // 2. Data mais antiga do último carimbo asc (quem atingiu a marca primeiro)
  // 3. Nome em ordem alfabética asc
  const ranked = passports
    .map((p) => {
      const confirmedCount = p.stamps.length;
      const lastStampDate = p.stamps[0]?.stampedAt ? new Date(p.stamps[0].stampedAt).getTime() : Infinity;

      return {
        id: p.id,
        name: p.user.name,
        email: p.user.email,
        passportNumber: p.passportNumber,
        confirmedCount,
        lastStampDate,
        lastStampFormatted: p.stamps[0]?.stampedAt
          ? new Date(p.stamps[0].stampedAt).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
      };
    })
    .sort((a, b) => {
      if (b.confirmedCount !== a.confirmedCount) {
        return b.confirmedCount - a.confirmedCount;
      }
      if (a.lastStampDate !== b.lastStampDate) {
        return a.lastStampDate - b.lastStampDate;
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ranking de Assiduidade</h1>
        <p className="text-sm text-muted">
          Critérios de desempate: maior quantidade de presenças, data mais antiga da última participação e ordem alfabética. Visível apenas para a administração.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-primary/20 bg-surface shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-muted/20 bg-background/50 text-muted uppercase text-[10px] font-bold">
              <tr>
                <th className="p-4">Posição</th>
                <th className="p-4">Participante</th>
                <th className="p-4">Passaporte</th>
                <th className="p-4">Presenças Confirmadas</th>
                <th className="p-4">Última Presença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/10">
              {ranked.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted">
                    Nenhuma presença registrada até o momento.
                  </td>
                </tr>
              ) : (
                ranked.map((item, idx) => {
                  const isTop1 = idx === 0 && item.confirmedCount > 0;
                  const isTop2 = idx === 1 && item.confirmedCount > 0;
                  const isTop3 = idx === 2 && item.confirmedCount > 0;

                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition">
                      <td className="p-4 font-black">
                        {isTop1 ? (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-premium text-background font-black text-xs shadow-md">
                            1º
                          </span>
                        ) : isTop2 ? (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/40 text-foreground font-black text-xs">
                            2º
                          </span>
                        ) : isTop3 ? (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-700/60 text-white font-black text-xs">
                            3º
                          </span>
                        ) : (
                          <span className="text-muted/60 pl-2 font-mono">#{idx + 1}</span>
                        )}
                      </td>
                      <td className="p-4 font-bold text-foreground">
                        {item.name}
                        <p className="text-[10px] font-normal text-muted">{item.email}</p>
                      </td>
                      <td className="p-4 font-mono text-secondary">{item.passportNumber}</td>
                      <td className="p-4">
                        <span className="text-sm font-black text-success">{item.confirmedCount}</span>{" "}
                        <span className="text-[10px] text-muted">eventos</span>
                      </td>
                      <td className="p-4 text-muted">{item.lastStampFormatted}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
