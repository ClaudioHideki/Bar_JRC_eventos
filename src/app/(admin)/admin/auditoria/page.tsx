import { prisma } from "@/lib/db/prisma";

export default async function AdminAuditoriaPage() {
  const logs = await prisma.auditLog.findMany({
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Logs de Auditoria de Segurança</h1>
        <p className="text-sm text-muted">
          Rastreabilidade completa de todas as operações críticas. Tokens, senhas e códigos são permanentemente redigidos.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-primary/20 bg-surface shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-muted/20 bg-background/50 text-muted uppercase text-[10px] font-bold">
              <tr>
                <th className="p-4">Data / Hora</th>
                <th className="p-4">Ação</th>
                <th className="p-4">Entidade</th>
                <th className="p-4">Autor</th>
                <th className="p-4">Metadados Auditados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/10">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted">
                    Nenhum log registrado.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition">
                    <td className="p-4 text-muted text-[11px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-xs font-bold text-secondary">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-muted">
                      {log.entity} {log.entityId ? `(#${log.entityId.slice(0, 8)})` : ""}
                    </td>
                    <td className="p-4 text-foreground">
                      {log.user ? (
                        <div>
                          <p className="font-semibold">{log.user.name}</p>
                          <p className="text-[10px] text-muted">{log.actorRole}</p>
                        </div>
                      ) : (
                        <span className="text-muted/60">{log.actorRole || "SISTEMA"}</span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-[11px] text-muted max-w-md truncate">
                      {log.safeMetadata ? JSON.stringify(log.safeMetadata) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
