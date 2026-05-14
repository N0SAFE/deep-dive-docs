"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

type Phase = "idle" | "setup" | "orchestration" | "mesh" | "database" | "modules" | "complete";

const PHASES = [
  { id: "setup", label: "Setup Module", color: "rose", desc: "First-run wizard, user onboarding" },
  { id: "orchestration", label: "Mesh Orchestration", color: "amber", desc: "Loads persisted mesh URLs or starts fresh" },
  { id: "mesh", label: "Mesh Core Runtime", color: "indigo", desc: "Discovers peers, establishes connections" },
  { id: "database", label: "Global Database", color: "teal", desc: "Waits for mesh to provide DB URL" },
  { id: "modules", label: "Feature Modules", color: "emerald", desc: "All modules that depend on DB" },
] as const;

export function MeshOrchestrationFlow() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [running, setRunning] = useState(false);

  const simulate = async () => {
    setRunning(true);
    setPhase("setup");
    await sleep(1200);

    setPhase("orchestration");
    await sleep(1200);

    setPhase("mesh");
    await sleep(1200);

    setPhase("database");
    await sleep(1200);

    setPhase("modules");
    await sleep(1200);

    setPhase("complete");
    setRunning(false);
  };

  const reset = () => {
    setPhase("idle");
    setRunning(false);
  };

  return (
    <div className="my-6 rounded-xl border border-border bg-surface/40 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-indigo-soft">
            Mesh Orchestration Startup
          </div>
          <div className="text-[12px] text-muted-foreground">
            Startup gate: setup blocks mesh, mesh blocks database, database blocks everything else
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={simulate} disabled={running} className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50">
            boot
          </button>
          <button onClick={reset} className="rounded-md border border-border px-3 py-1 text-sm">
            reset
          </button>
        </div>
      </div>

      {/* Timeline */}
      <ol className="space-y-3">
        {PHASES.map((p, i) => {
          const isActive = phase === p.id;
          const isPast =
            (phase === "complete" && true) ||
            (["setup", "orchestration", "mesh", "database", "modules"].indexOf(phase) >= i);
          const color = `var(--${p.color})`;

          return (
            <motion.li
              key={p.id}
              animate={{
                opacity: isActive || isPast ? 1 : phase === "idle" ? 0.5 : 0.4,
                scale: isActive ? 1.02 : 1,
              }}
              className={
                "relative flex items-start gap-3 rounded-lg border px-4 py-3 transition " +
                (isActive
                  ? "border-current bg-surface shadow-sm"
                  : isPast
                    ? "border-current/40 bg-surface/60"
                    : "border-border/60 bg-surface/40")
              }
              style={{ borderColor: isPast || isActive ? color : undefined }}
            >
              {/* Step indicator */}
              <motion.div
                animate={{
                  backgroundColor: isActive ? color : isPast ? color : "var(--muted)",
                  scale: isActive ? 1.1 : 1,
                }}
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white font-mono text-[10px]"
              >
                {isActive ? "●" : isPast ? "✓" : i + 1}
              </motion.div>

              <div className="flex-1">
                <div className="font-display text-sm font-semibold" style={{ color: isPast || isActive ? color : undefined }}>
                  {p.label}
                </div>
                <div className="text-[11px] text-muted-foreground">{p.desc}</div>

                {/* Blocking reason */}
                {!isPast && !isActive && phase !== "idle" && (
                  <div className="mt-1.5 text-[11px] text-muted-foreground">
                    Waiting for {PHASES[PHASES.findIndex((x) => x.id === phase)].label}...
                  </div>
                )}
              </div>

              {/* Checkmark or spinner */}
              <AnimatePresence>
                {isPast && phase !== "idle" && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-emerald text-sm">
                    ✓
                  </motion.span>
                )}
                {isActive && (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <div className="h-4 w-4 rounded-full border-2 border-transparent border-t-current" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ol>

      {/* Info boxes */}
      <AnimatePresence mode="wait">
        {phase !== "idle" && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="mt-4 space-y-2">
            {phase === "setup" && (
              <div className="rounded-lg border border-rose/30 bg-rose/10 p-3 text-[12px] text-rose">
                First-run only. User picks "create new mesh" or "join existing mesh".
              </div>
            )}
            {phase === "orchestration" && (
              <div className="rounded-lg border border-amber/30 bg-amber/10 p-3 text-[12px] text-amber">
                Reads persisted mesh URLs from local DB. On subsequent boots, reconnects automatically.
              </div>
            )}
            {phase === "mesh" && (
              <div className="rounded-lg border border-indigo/30 bg-indigo/10 p-3 text-[12px] text-indigo">
                Discovers peers, performs authenticated handshakes, establishes control-plane connections.
              </div>
            )}
            {phase === "database" && (
              <div className="rounded-lg border border-teal/30 bg-teal/10 p-3 text-[12px] text-teal">
                Waits for mesh to provide runtime database URL. This is the critical gate.
              </div>
            )}
            {phase === "modules" && (
              <div className="rounded-lg border border-emerald/30 bg-emerald/10 p-3 text-[12px] text-emerald">
                All feature modules (deployment, service, etc.) that depend on database can now start.
              </div>
            )}
            {phase === "complete" && (
              <div className="rounded-lg border border-foreground/30 bg-foreground/10 p-3 text-[12px] text-foreground">
                System ready. No mutations can run until this completes. Mesh URL is persisted for restart recovery.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
