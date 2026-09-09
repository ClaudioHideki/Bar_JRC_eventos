import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await req.json();
    const { imageBase64 } = body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });
    }

    // Limite de segurança para payload de imagem (máximo 4MB em base64)
    if (imageBase64.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "A foto deve ter tamanho inferior a 4MB." },
        { status: 400 }
      );
    }

    // Atualiza apenas a foto do usuário. Não toca na tabela Stamp nem nos carimbos!
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { image: imageBase64 },
    });

    return NextResponse.json({
      success: true,
      image: updatedUser.image,
    });
  } catch (err: unknown) {
    console.error("Erro ao atualizar foto:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao atualizar foto." },
      { status: 500 }
    );
  }
}
