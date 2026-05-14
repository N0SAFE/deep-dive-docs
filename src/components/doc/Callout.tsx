import { cn } from "@/lib/utils";
import { Info, Lightbulb, AlertTriangle, Sparkles, Zap } from "lucide-react";
import type { ReactNode } from "react";

type Variant = "info" | "tip" | "warn" | "tldr" | "spec";

const styles: Record<Variant, { ring: string; icon: ReactNode; label: string }> = {
  info: { ring: "from-indigo/30", icon: <Info className="h-4 w-4" />, label: "Note" },
  tip: { ring: "from-teal/30", icon: <Lightbulb className="h-4 w-4" />, label: "Tip" },
  warn: { ring: "from-amber/30", icon: <AlertTriangle className="h-4 w-4" />, label: "Watch out" },
  tldr: { ring: "from-indigo/40", icon: <Sparkles className="h-4 w-4" />, label: "TL;DR" },
  spec: { ring: "from-emerald/30", icon: <Zap className="h-4 w-4" />, label: "Spec" },
};

export function Callout({
  variant = "info",
  title,
  children,
}: {
  variant?: Variant;
  title?: string;
  children: ReactNode;
}) {
  const s = styles[variant];
  return (
    <div
      className={cn(
        "relative my-6 overflow-hidden rounded-xl border border-border bg-surface/60 p-5",
        "before:absolute before:inset-0 before:-z-10 before:bg-gradient-to-br before:to-transparent",
        s.ring
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-indigo-soft">
        {s.icon}
        {title ?? s.label}
      </div>
      <div className="prose-doc text-foreground/90">{children}</div>
    </div>
  );
}
