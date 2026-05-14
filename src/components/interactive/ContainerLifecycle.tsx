"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const CHILDREN = ["mesh", "scheduler", "router", "event-bus", "metrics", "logs"];

export function ContainerLifecycle() {
  const [running, setRunning] = useState(true);
  const [terminated, setTerminated] = useState<string[]>([]);

  const uninstall = async () => {
    setTerminated([]);
    for (let i = CHILDREN.length - 1; i >= 0; i--) {
      await new Promise((r) => setTimeout(r, 280));
      setTerminated((t) => [...t, CHILDREN[i]]);
    }
    await new Promise((r) => setTimeout(r, 320));
    setRunning(false);
  };

  const reset = () => {
    setRunning(true);
    setTerminated([]);
  };

  return (
    <div className="my-6 rounded-xl border border-border bg-surface/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-indigo-soft">Container ownership tree</div>
          <div className="text-[12px] text-muted-foreground">Uninstall removes only the root. Children must terminate themselves.</div>
        </div>
        <div className="flex gap-2 text-[12px]">
          <button onClick={uninstall} className="rounded-md border border-rose/40 bg-rose/10 px-3 py-1 text-rose">uninstall root</button>
          <button onClick={reset} className="rounded-md border border-border px-3 py-1">reset</button>
        </div>
      </div>

      <div className="mx-auto max-w-md">
        <AnimatePresence>
          {running && (
            <motion.div
              key="root"
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.4 }}
              className="mb-3 rounded-lg border border-indigo/50 bg-indigo/15 p-3 text-center"
            >
              <div className="font-display text-sm font-semibold">root container</div>
              <div className="font-mono text-[11px] text-muted-foreground">api + web · ownership boundary</div>
            </motion.div>
          )}
        </AnimatePresence>
        {!running && (
          <div className="mb-3 rounded-lg border border-dashed border-border p-3 text-center text-[12px] text-muted-foreground">
            root container removed
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CHILDREN.map((c) => {
            const dead = terminated.includes(c) || !running;
            return (
              <motion.div
                key={c}
                animate={{ opacity: dead ? 0.25 : 1, scale: dead ? 0.96 : 1 }}
                className={
                  "rounded-md border px-3 py-2 text-center font-mono text-[12px] transition " +
                  (dead ? "border-border/40 bg-surface/30 text-muted-foreground line-through" : "border-teal/30 bg-teal/10 text-teal")
                }
              >
                {c}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
