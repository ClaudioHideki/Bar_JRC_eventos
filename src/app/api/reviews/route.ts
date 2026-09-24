import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { createEventReview } from "@/lib/domain/event-reviews";

export async function POST(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session || session.user.role !== "PARTICIPANT") {
    return NextResponse.json({ error: "Acesso restrito a participantes." }, { status: 403 });
  }
  try {
    const { eventId, rating, feedback } = await req.json();
    if (typeof eventId !== "string" || typeof feedback !== "string") {
      return NextResponse.json({ error: "Dados da avaliação inválidos." }, { status: 400 });
    }
    const review = await createEventReview(session.user.id, eventId, rating, feedback);
    return NextResponse.json({ id: review.id, success: true }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar a avaliação.";
    return NextResponse.json({ error: message }, { status: message.includes("Unique constraint") ? 409 : 400 });
  }
}
