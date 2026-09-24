import { prisma } from "../db/prisma";

export function validateEventReview(rating: number, feedback: string): { rating: number; feedback: string | null } {
  if (!Number.isInteger(rating) || rating < 0 || rating > 10) {
    throw new Error("A nota deve ser um número inteiro de 0 a 10.");
  }
  if (typeof feedback !== "string" || feedback.length > 2000) {
    throw new Error("O comentário deve ter no máximo 2000 caracteres.");
  }
  return { rating, feedback: feedback.trim() || null };
}

export async function createEventReview(userId: string, eventId: string, rating: number, feedback: string) {
  const values = validateEventReview(rating, feedback);
  const passport = await prisma.passport.findUnique({ where: { userId } });
  if (!passport || passport.status !== "ACTIVE") {
    throw new Error("Passaporte ativo não encontrado.");
  }
  const stamp = await prisma.stamp.findFirst({
    where: { passportId: passport.id, eventId, status: "CONFIRMED", event: { programId: passport.programId } },
    select: { id: true },
  });
  if (!stamp) {
    throw new Error("A avaliação fica disponível após o carimbo confirmado deste evento.");
  }
  return prisma.eventReview.create({
    data: { passportId: passport.id, eventId, ...values },
  });
}
