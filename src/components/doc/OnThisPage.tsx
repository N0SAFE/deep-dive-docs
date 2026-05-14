"use client";
import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

export function OnThisPage() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const headings = Array.from(document.querySelectorAll<HTMLElement>("main h2[id]"));
    setItems(headings.map((h) => ({ id: h.id, text: h.textContent ?? "" })));
    if (!headings.length) return;
    const onScroll = () => {
      let current = headings[0].id;
      for (const h of headings) {
        if (h.getBoundingClientRect().top < 120) current = h.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [path]);

  if (!items.length) return null;
  return (
    <aside className="sticky top-8 hidden h-[calc(100vh-4rem)] w-56 shrink-0 xl:block">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        On this page
      </div>
      <ul className="mt-3 space-y-1.5 border-l border-border/60">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className={
                "block border-l-2 px-3 py-1 text-[13px] leading-snug transition " +
                (active === it.id
                  ? "border-indigo text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
