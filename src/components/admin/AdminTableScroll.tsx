"use client";

import { useEffect, useRef, useState } from "react";

export function AdminTableScroll({ children, label }: { children: React.ReactNode; label: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => {
      const hasOverflow = element.scrollWidth > element.clientWidth + 2;
      setOverflow(hasOverflow);
      setCanScrollLeft(element.scrollLeft > 2);
      setCanScrollRight(hasOverflow && element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", update); };
  }, [children]);

  return (
    <div className="min-w-0">
      {overflow && <div className="flex items-center justify-between gap-3 border-b border-muted/20 bg-background/50 px-4 py-2 text-xs text-muted">
        <span>Mais colunas disponíveis. Use os botões ou deslize a tabela.</span>
        <div className="flex shrink-0 gap-2">
          <button type="button" aria-label={`Rolar ${label} para a esquerda`} disabled={!canScrollLeft} onClick={() => scrollRef.current?.scrollBy({ left: -320, behavior: "smooth" })} className="rounded-lg border border-muted/40 px-3 py-1.5 font-bold text-foreground disabled:opacity-40">←</button>
          <button type="button" aria-label={`Rolar ${label} para a direita`} disabled={!canScrollRight} onClick={() => scrollRef.current?.scrollBy({ left: 320, behavior: "smooth" })} className="rounded-lg border border-muted/40 px-3 py-1.5 font-bold text-foreground disabled:opacity-40">→</button>
        </div>
      </div>}
      <div ref={scrollRef} role="region" aria-label={label} tabIndex={0} className="admin-table-scroll overflow-x-auto overscroll-x-contain">
        {children}
      </div>
    </div>
  );
}
