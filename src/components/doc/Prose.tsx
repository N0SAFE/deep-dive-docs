import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <header className="mb-10 border-b border-border/60 pb-8">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-soft">
        {eyebrow}
      </div>
      <h1 className="font-display text-4xl font-bold leading-[1.1] md:text-5xl">{title}</h1>
      {lead && <p className="mt-4 max-w-3xl text-lg text-muted-foreground">{lead}</p>}
    </header>
  );
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="group mb-3 mt-12 scroll-mt-24 font-display text-2xl font-bold tracking-tight"
    >
      <a href={`#${id}`} className="opacity-100">
        <span className="mr-2 text-indigo-soft/60 opacity-0 transition group-hover:opacity-100">#</span>
        {children}
      </a>
    </h2>
  );
}

export function H3({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="mb-2 mt-8 scroll-mt-24 font-display text-lg font-semibold text-foreground/90">
      {children}
    </h3>
  );
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("my-3 text-foreground/85", className)}>{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="my-3 list-disc space-y-1.5 pl-6 text-foreground/85 marker:text-indigo-soft/60">{children}</ul>;
}

export function OL({ children }: { children: ReactNode }) {
  return <ol className="my-3 list-decimal space-y-1.5 pl-6 text-foreground/85 marker:text-indigo-soft/60">{children}</ol>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-block rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-foreground/90">
      {children}
    </kbd>
  );
}

export function Term({ children, def }: { children: ReactNode; def: string }) {
  return (
    <span
      title={def}
      className="cursor-help border-b border-dashed border-indigo-soft/60 text-indigo-soft"
    >
      {children}
    </span>
  );
}
