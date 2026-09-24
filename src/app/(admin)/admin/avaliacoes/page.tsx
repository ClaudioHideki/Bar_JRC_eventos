import { prisma } from "@/lib/db/prisma";

export default async function ReviewsPage() {
  const reviews = await prisma.eventReview.findMany({
    include: { event: { select: { name: true } }, passport: { include: { user: { select: { name: true, realEstateAgency: true } } } } },
    orderBy: { submittedAt: "desc" },
  });
  const average = reviews.length ? (reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1) : "—";
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-black">Avaliações dos eventos</h1><p className="text-sm text-muted">{reviews.length} respostas · Nota média: {average}</p></div>
    <div className="space-y-3">{reviews.map((review) => <article key={review.id} className="rounded-2xl border border-primary/20 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{review.event.name}</h2><strong className="text-premium">{review.rating}/10</strong></div>
      <p className="text-xs text-muted">{review.passport.user.name} · {review.passport.user.realEstateAgency || "Sem imobiliária"} · {review.submittedAt.toLocaleDateString("pt-BR")}</p>
      {review.feedback && <p className="mt-3 whitespace-pre-wrap text-sm">{review.feedback}</p>}
    </article>)}</div>
  </div>;
}
