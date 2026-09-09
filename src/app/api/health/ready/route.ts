import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    // Validação real de conexão com o PostgreSQL
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ready",
      },
      { status: 200 }
    );
  } catch {
    // Resposta sanitizada sem expor detalhes internos ou string de conexão
    return NextResponse.json(
      {
        status: "unhealthy",
        error: "Banco de dados indisponível",
      },
      { status: 503 }
    );
  }
}
