"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

type Step = {
  id: string;
  label: string;
  service: string;
  compensate: string;
};

const STEPS: Step[] = [
  { id: "1", label: "reserve quota", service: "billing", compensate: "release quota" },
  { id: "2", label: "create deployment", service: "deployer", compensate: "destroy deployment" },
  { id: "3", label: "allocate replicas", service: "scheduler", compensate: "free replicas" },
  { id: "4", label: "wire routing", service: "router", compensate: "tear down routes" },
  { id: "5", label: "publish event", service: "event-bus", compensate: "publish rollback" },
];

export function SagaTimeline() {
  const [i, setI] = useState(0);
  const [failAt, setFailAt] = useState<number>(3);
  const [phase, setPhase] = useState<"forward" | "compensate" | "done">("forward");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => {
      if (phase === "forward") {
        if (i + 1 === failAt) {
          setPhase("compensate");
          setI(failAt - 1);
        } else if (i >= STEPS.length - 1) {
          setPhase("done");
          setRunning(false);
        } else {
          setI((x) => x + 1);
        }
      } else if (phase === "compensate") {
        if (i <= 0) {
          setPhase("done");
          setRunning(false);
        } else {
          setI((x) => x - 1);
        }
      }
    }, 850);
    return () => clearTimeout(t);
  }, [running, i, phase, failAt]);

  const reset = () => {
    setI(0);
    setPhase("forward");
    setRunning(false);
  };

  return (
    <div className="my-6 rounded-xl border border-border bg-surface/40 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-indigo-soft">Distributed saga</div>
          <div className="text-[12px] text-muted-foreground">
            Forward steps run in order. On failure the coordinator runs compensations in reverse.
          </div>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <label className="text-muted-foreground">fail at step</label>
          <select
            className="rounded-md border border-border bg-[var(--code-bg)] px-2 py-1 font-mono"
            value={failAt}
            onChange={(e) => { setFailAt(+e.target.value); reset(); }}
          >
            <option value={0}>never</option>
            {STEPS.map((s, idx) => (
              <option key={s.id} value={idx + 1}>step {idx + 1}</option>
            ))}
          </select>
          <button onClick={() => { reset(); setRunning(true); }} className="rounded-md bg-primary px-3 py-1 text-primary-foreground">play</button>
          <button onClick={reset} className="rounded-md border border-border px-3 py-1">reset</button>
        </div>
      </div>

      <ol className="relative space-y-2">
        {STEPS.map((s, idx) => {
          const isCurrent = idx === i;
          const isFailing = phase === "compensate" && idx === failAt - 1 && i === idx;
          const compensated = phase === "compensate" && idx > i;
          const finalCompensated = phase === "done" && failAt > 0;

          let status: "pending" | "active" | "ok" | "fail" | "comp" = "pending";
          if (phase === "forward") {
            if (idx < i) status = "ok";
            else if (idx === i) status = "active";
          } else if (phase === "compensate") {
            if (compensated || (idx === failAt - 1 && i < idx)) status = "comp";
            else if (idx === i) status = "comp";
            else if (idx < failAt - 1 && idx <= i) status = "ok";
            if (idx === failAt - 1 && i === idx) status = "fail";
          } else if (phase === "done") {
            if (finalCompensated && idx < failAt) status = "comp";
            else if (failAt === 0) status = "ok";
          }

          const colors = {
            pending: "border-border/60 bg-surface/40 text-muted-foreground",
            active: "border-indigo/60 bg-indigo/10 text-foreground",
            ok: "border-emerald/40 bg-emerald/10 text-emerald",
            fail: "border-rose/50 bg-rose/10 text-rose",
            comp: "border-amber/40 bg-amber/10 text-amber",
          }[status];
          const icon = { pending: "○", active: "●", ok: "✓", fail: "✕", comp: "↶" }[status];

          return (
            <li key={s.id} className={"flex items-center gap-3 rounded-md border px-3 py-2 transition " + colors}>
              <span className="font-mono text-sm">{icon}</span>
              <div className="flex-1">
                <div className="font-display text-[13px] font-semibold">{idx + 1}. {s.label}</div>
                <div className="font-mono text-[11px] opacity-70">service: {s.service} · compensation: {s.compensate}</div>
              </div>
              <AnimatePresence>
                {isCurrent && phase !== "done" && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] uppercase tracking-widest"
                  >
                    {phase === "forward" ? (isFailing ? "failing" : "running") : "rolling back"}
                  </motion.span>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
