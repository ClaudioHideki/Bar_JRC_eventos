"use client";

import { useState } from "react";

interface ReviewableEvent { id: string; name: string; stampedAt: string }

export function EventReviewsClient({ events, reviewedEventIds }: { events: ReviewableEvent[]; reviewedEventIds: string[] }) {
  const [completed, setCompleted] = useState(new Set(reviewedEventIds));
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (eventId: string) => {
    setPending(eventId);
    setError(null);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, rating: ratings[eventId], feedback: feedbacks[eventId] || "" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Erro ao enviar avaliação.");
      setCompleted((previous) => new Set(previous).add(eventId));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Erro ao enviar avaliação.");
    } finally {
      setPending(null);
    }
  };

  if (!events.length) return null;
  return <section aria-labelledby="reviews-heading" className="space-y-3">
    <h2 id="reviews-heading" className="text-sm font-bold uppercase tracking-wider text-premium">Avalie os eventos carimbados</h2>
    <p className="text-xs text-muted">Sua opinião ajuda a melhorar os próximos encontros.</p>
    {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">{error}</p>}
    {events.map((event) => <div key={event.id} className="rounded-2xl border border-primary/20 bg-surface p-4 space-y-3">
      <h3 className="text-sm font-bold">{event.name}</h3>
      {completed.has(event.id) ? <p className="text-xs text-success">Avaliação registrada. Obrigado!</p> : <>
        <fieldset>
          <legend className="mb-2 text-xs text-muted">Sua nota de 0 a 10</legend>
          <div className="flex flex-wrap gap-1.5">{Array.from({ length: 11 }, (_, rating) => <button
            key={rating} type="button" aria-label={`Nota ${rating}`} aria-pressed={ratings[event.id] === rating}
            onClick={() => setRatings((value) => ({ ...value, [event.id]: rating }))}
            className={`h-8 w-8 rounded-lg text-xs font-bold ${ratings[event.id] === rating ? "bg-primary text-white" : "border border-muted/30 text-muted"}`}
          >{rating}</button>)}</div>
        </fieldset>
        <label className="block text-xs text-muted">O que achou? O que podemos melhorar?
          <textarea maxLength={2000} rows={3} value={feedbacks[event.id] || ""}
            onChange={(e) => setFeedbacks((value) => ({ ...value, [event.id]: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-muted/30 bg-background p-3 text-sm text-foreground" />
        </label>
        <button type="button" disabled={ratings[event.id] === undefined || pending === event.id}
          onClick={() => submit(event.id)} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
          {pending === event.id ? "Enviando..." : "Enviar avaliação"}
        </button>
      </>}
    </div>)}
  </section>;
}
