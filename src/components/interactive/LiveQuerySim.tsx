"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

type Row = { id: string; deployment: string; status: string; node: string; ts: string };

const NAMES = ["api-edge", "worker-batch", "billing-svc", "auth-portal", "ingestor", "render-bot"];
const NODES = ["us-e-1", "us-w-2", "eu-c-3", "ap-s-4"];
const STATUSES = ["running", "scaling", "failing", "degraded", "running", "running"];

export function LiveQuerySim() {
  const [rows, setRows] = useState<Row[]>([]);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(900);
  const idRef = useRef(0);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      idRef.current += 1;
      const r: Row = {
        id: `evt-${idRef.current.toString().padStart(4, "0")}`,
        deployment: NAMES[Math.floor(Math.random() * NAMES.length)],
        status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
        node: NODES[Math.floor(Math.random() * NODES.length)],
        ts: new Date().toLocaleTimeString(),
      };
      setRows((prev) => [r, ...prev].slice(0, 12));
    }, rate);
    return () => clearInterval(t);
  }, [paused, rate]);

  return (
    <div className="my-6 rounded-xl border border-border bg-surface/40 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-indigo-soft">Live query stream</div>
          <div className="text-[12px] text-muted-foreground">
            <code className="text-foreground/90">discovery.from(deployments).live().subscribe(...)</code>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <label className="text-muted-foreground">rate {rate}ms</label>
          <input type="range" min={300} max={2500} step={100} value={rate} onChange={(e) => setRate(+e.target.value)} className="w-32 accent-[var(--indigo)]" />
          <button onClick={() => setPaused((p) => !p)} className="rounded-md border border-border px-3 py-1">
            {paused ? "resume" : "pause"}
          </button>
          <button onClick={() => setRows([])} className="rounded-md border border-border px-3 py-1">clear</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border/60">
        <div className="grid grid-cols-[1fr_1.2fr_0.8fr_0.8fr_0.8fr] bg-surface-2/50 px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">
          <span>id</span><span>deployment</span><span>status</span><span>node</span><span>ts</span>
        </div>
        <AnimatePresence initial={false}>
          {rows.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: -6, backgroundColor: "color-mix(in oklab, var(--indigo) 25%, transparent)" }}
              animate={{ opacity: 1, y: 0, backgroundColor: "rgba(0,0,0,0)" }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-[1fr_1.2fr_0.8fr_0.8fr_0.8fr] border-t border-border/40 px-3 py-1.5 font-mono text-[12px]"
            >
              <span className="text-muted-foreground">{r.id}</span>
              <span className="text-foreground">{r.deployment}</span>
              <span className={
                r.status === "failing" ? "text-rose" :
                r.status === "degraded" ? "text-amber" :
                r.status === "scaling" ? "text-indigo-soft" : "text-emerald"
              }>{r.status}</span>
              <span className="text-foreground/80">{r.node}</span>
              <span className="text-muted-foreground">{r.ts}</span>
            </motion.div>
          ))}
          {rows.length === 0 && (
            <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">awaiting events…</div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
