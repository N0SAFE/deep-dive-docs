"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";

const MODULES = [
  { id: "config", label: "config-loader", deps: [] as string[], desc: "Reads env + sealed secrets." },
  { id: "db", label: "local-db", deps: ["config"], desc: "Opens local SQLite/Postgres for persisted mesh URLs." },
  { id: "identity", label: "node-identity", deps: ["db"], desc: "Loads node keypair; halts boot if missing on second run." },
  { id: "mesh", label: "mesh-client", deps: ["identity", "db"], desc: "Reads peer URLs from DB and reconnects." },
  { id: "discovery", label: "discovery-svc", deps: ["mesh"], desc: "Subscribes to fleet topics, emits live registry." },
  { id: "scheduler", label: "scheduler", deps: ["discovery"], desc: "Owns deployment placement decisions." },
  { id: "router", label: "router", deps: ["discovery"], desc: "Maintains live ingress routing table." },
  { id: "api", label: "api-surface", deps: ["scheduler", "router"], desc: "Exposes ORPC + REST. Last to come online." },
];

export function ModuleChain() {
  const [up, setUp] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (up.length === MODULES.length) {
      setRunning(false);
      return;
    }
    const t = setTimeout(() => setUp((u) => [...u, MODULES[u.length].id]), 600);
    return () => clearTimeout(t);
  }, [running, up]);

  const reset = () => { setUp([]); setRunning(false); };

  return (
    <div className="my-6 rounded-xl border border-border bg-surface/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-indigo-soft">Async module chain</div>
          <div className="text-[12px] text-muted-foreground">Each module waits for its dependency set to reach <code>ready</code>.</div>
        </div>
        <div className="flex gap-2 text-[12px]">
          <button onClick={() => { reset(); setRunning(true); }} className="rounded-md bg-primary px-3 py-1 text-primary-foreground">boot</button>
          <button onClick={reset} className="rounded-md border border-border px-3 py-1">reset</button>
        </div>
      </div>
      <ol className="space-y-2">
        {MODULES.map((m) => {
          const isUp = up.includes(m.id);
          const isNext = up.length === MODULES.findIndex((x) => x.id === m.id);
          return (
            <motion.li
              key={m.id}
              animate={{ opacity: isUp ? 1 : isNext && running ? 0.85 : 0.5 }}
              className={
                "flex items-start gap-3 rounded-md border px-3 py-2 " +
                (isUp ? "border-emerald/30 bg-emerald/10" : isNext && running ? "border-indigo/40 bg-indigo/10" : "border-border/60 bg-surface/40")
              }
            >
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted/60 font-mono text-[10px]">
                {isUp ? "✓" : isNext && running ? "…" : "○"}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[13px] font-semibold">{m.label}</span>
                  {m.deps.length > 0 && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      depends on: {m.deps.join(", ")}
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-muted-foreground">{m.desc}</div>
              </div>
              <span className={"text-[10px] font-mono uppercase " + (isUp ? "text-emerald" : "text-muted-foreground")}>
                {isUp ? "ready" : "pending"}
              </span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
