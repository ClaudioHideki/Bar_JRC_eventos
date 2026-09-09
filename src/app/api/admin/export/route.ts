import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { sanitizeCsvCell } from "@/lib/security/crypto";
import { UserRole } from "@prisma/client";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }

    const stamps = await prisma.stamp.findMany({
      include: {
        passport: {
          include: {
            user: true,
          },
        },
        event: true,
        attendant: true,
      },
      orderBy: { stampedAt: "desc" },
    });

    const headers = [
      "ID Carimbo",
      "Participante",
      "Imobiliária",
      "E-mail",
      "Número Passaporte",
      "Evento",
      "Atendente",
      "Data/Hora",
      "Aceite LGPD",
      "Status",
    ];

    const rows = stamps.map((s) => [
      sanitizeCsvCell(s.id),
      sanitizeCsvCell(s.passport.user.name),
      sanitizeCsvCell(s.passport.user.realEstateAgency || "Não informada"),
      sanitizeCsvCell(s.passport.user.email),
      sanitizeCsvCell(s.passport.passportNumber),
      sanitizeCsvCell(s.event.name),
      sanitizeCsvCell(s.attendant.name),
      sanitizeCsvCell(s.stampedAt.toISOString()),
      sanitizeCsvCell(s.passport.user.lgpdConsent ? "Sim" : "Não"),
      sanitizeCsvCell(s.status),
    ]);

    const csvContent = "\uFEFF" + [headers.map((h) => `"${h}"`).join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="passaporte-jrc-carimbos-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Erro ao gerar exportação CSV." }, { status: 500 });
  }
}
