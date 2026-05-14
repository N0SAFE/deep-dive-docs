"use client";
import { Link, useRouterState } from "@tanstack/react-router";
import { DOC_NAV, FLAT_NAV } from "@/lib/doc-nav";
import { cn } from "@/lib/utils";
import { ChevronRight, Network } from "lucide-react";

export function DocSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="scrollbar-thin sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-border/60 bg-[var(--sidebar)] lg:block">
      <Link to="/" className="block border-b border-border/60 px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo/15 text-indigo-soft">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <div className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-soft">
              Mesh Architecture
            </div>
            <div className="text-[11px] text-muted-foreground">Distributed Query &amp; Orchestration</div>
          </div>
        </div>
      </Link>
      <nav className="px-3 py-4">
        {DOC_NAV.map((group) => (
          <div key={group.group} className="mb-5">
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
              {group.group}
            </div>
            <ul>
              {group.items.map((item) => {
                const active = path === item.to;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={cn(
                        "group flex items-center justify-between rounded-md px-3 py-1.5 text-sm transition",
                        active
                          ? "bg-indigo/15 text-foreground"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      )}
                    >
                      <span className={cn("truncate", active && "font-medium")}>{item.title}</span>
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100",
                          active && "translate-x-0 opacity-100 text-indigo-soft"
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function DocPagination() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const idx = FLAT_NAV.findIndex((i) => i.to === path);
  if (idx === -1) return null;
  const prev = FLAT_NAV[idx - 1];
  const next = FLAT_NAV[idx + 1];
  return (
    <div className="mt-20 grid gap-3 border-t border-border/60 pt-8 sm:grid-cols-2">
      {prev ? (
        <Link
          to={prev.to}
          className="group rounded-xl border border-border/60 bg-surface/40 p-4 transition hover:border-indigo/50"
        >
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Previous</div>
          <div className="mt-1 font-display font-semibold text-foreground group-hover:text-indigo-soft">
            ← {prev.title}
          </div>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          to={next.to}
          className="group rounded-xl border border-border/60 bg-surface/40 p-4 text-right transition hover:border-indigo/50"
        >
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Next</div>
          <div className="mt-1 font-display font-semibold text-foreground group-hover:text-indigo-soft">
            {next.title} →
          </div>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
