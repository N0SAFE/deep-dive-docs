"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";

type Candidate = {
  id: string;
  latency: number;
  jitter: number;
  load: number;
  capacity: number;
};

const CANDIDATES: Candidate[] = [
  { id: "node-a", latency: 18, jitter: 2, load: 0.15, capacity: 0.92 },
  { id: "node-b", latency: 52, jitter: 9, load: 0.65, capacity: 0.58 },
  { id: "node-c", latency: 145, jitter: 25, load: 0.42, capacity: 0.71 },
  { id: "node-d", latency: 68, jitter: 16, load: 0.35, capacity: 0.84 },
  { id: "node-e", latency: 38, jitter: 4, load: 0.28, capacity: 0.95 },
];

const norm = (v: number, max: number) => Math.min(1, Math.max(0, v / max));

export function MeshPeerSelectionVisual() {
  const [wLatency, setWLatency] = useState(0.45);
  const [wLoad, setWLoad] = useState(0.3);
  const [wCapacity, setWCapacity] = useState(0.25);
  const [budget, setBudget] = useState(100);
  const [k, setK] = useState(3);

  const scored = useMemo(() => {
    return CANDIDATES.map((c) => {
      const L = norm(c.latency, budget);
      const J = norm(c.jitter, 30);
      const Q = c.load;
      const C = c.capacity;

      const score = wLatency * L + wLoad * (J + Q) + wCapacity * (1 - C);
      return { ...c, L, J, Q, C, score };
    })
      .sort((a, b) => a.score - b.score);
  }, [wLatency, wLoad, wCapacity, budget]);

  const chosen = new Set(scored.slice(0, k).map((c) => c.id));

  return (
    <div className="my-6 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="rounded-xl border border-border bg-surface/40 p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-soft">
          Scoring Configuration
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-[12px]">
              <span className="text-muted-foreground">Weight Latency</span>
              <span className="font-mono text-foreground">{wLatency.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={wLatency}
              onChange={(e) => setWLatency(+e.target.value)}
              className="w-full accent-[var(--indigo)]"
            />
          </div>

          <div>
            <div className="mb-1 flex justify-between text-[12px]">
              <span className="text-muted-foreground">Weight Load (jitter + backlog)</span>
              <span className="font-mono text-foreground">{wLoad.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={wLoad}
              onChange={(e) => setWLoad(+e.target.value)}
              className="w-full accent-[var(--indigo)]"
            />
          </div>

          <div>
            <div className="mb-1 flex justify-between text-[12px]">
              <span className="text-muted-foreground">Weight Capacity (inverted)</span>
              <span className="font-mono text-foreground">{wCapacity.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={wCapacity}
              onChange={(e) => setWCapacity(+e.target.value)}
              className="w-full accent-[var(--indigo)]"
            />
          </div>

          <div
            className={
              "mt-2 rounded-md border px-3 py-2 text-[11px] " +
              (Math.abs(wLatency + wLoad + wCapacity - 1) < 0.01
                ? "border-emerald/30 bg-emerald/10 text-emerald"
                : "border-amber/30 bg-amber/10 text-amber")
            }
          >
            Σ w = {(wLatency + wLoad + wCapacity).toFixed(2)} {Math.abs(wLatency + wLoad + wCapacity - 1) < 0.01 ? "✓" : "(not normalized)"}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <div>
              <div className="mb-1 text-[12px] text-muted-foreground">Latency budget</div>
              <input
                type="range"
                min={50}
                max={200}
                step={10}
                value={budget}
                onChange={(e) => setBudget(+e.target.value)}
                className="w-full accent-[var(--indigo)]"
              />
              <div className="mt-1 text-center font-mono text-[11px]">{budget} ms</div>
            </div>
            <div>
              <div className="mb-1 text-[12px] text-muted-foreground">Target peers (k)</div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={k}
                onChange={(e) => setK(+e.target.value)}
                className="w-full accent-[var(--indigo)]"
              />
              <div className="mt-1 text-center font-mono text-[11px]">{k}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface/40 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-widest text-indigo-soft">
            Ranked Candidates
          </div>
          <div className="text-[11px] text-muted-foreground">Selected: {k}</div>
        </div>

        <div className="space-y-2">
          {scored.map((c) => {
            const isChosen = chosen.has(c.id);
            const rank = scored.indexOf(c) + 1;

            return (
              <motion.div
                key={c.id}
                animate={{ opacity: isChosen ? 1 : 0.7, scale: isChosen ? 1.02 : 1 }}
                className={
                  "rounded-lg border px-3 py-2 transition " +
                  (isChosen
                    ? "border-indigo/50 bg-indigo/15"
                    : "border-border/60 bg-surface/60")
                }
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] font-semibold" style={{ color: isChosen ? "var(--indigo)" : undefined }}>
                        #{rank} {c.id}
                      </span>
                      {isChosen && <span className="text-[10px] text-indigo-soft">● chosen</span>}
                    </div>
                    <div className="mt-1 flex gap-2 font-mono text-[11px] text-muted-foreground">
                      <span>lat={c.latency}ms</span>
                      <span>load={c.load.toFixed(2)}</span>
                      <span>cap={c.capacity.toFixed(2)}</span>
                    </div>
                  </div>
                  <div
                    className="text-right font-mono text-[13px] font-semibold"
                    style={{ color: isChosen ? "var(--teal)" : "var(--muted-foreground)" }}
                  >
                    {c.score.toFixed(3)}
                  </div>
                </div>

                {/* Score breakdown bar */}
                <div className="mt-2 flex h-1.5 gap-0.5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="bg-indigo/60"
                    style={{ width: `${wLatency * 100}%` }}
                    title="Latency component"
                  />
                  <div
                    className="bg-amber/60"
                    style={{ width: `${wLoad * 100}%` }}
                    title="Load component"
                  />
                  <div
                    className="bg-teal/60"
                    style={{ width: `${wCapacity * 100}%` }}
                    title="Capacity component"
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-3 text-[12px] text-muted-foreground">
          Lower score is better. Adjust weights and budget to see how peer selection changes.
        </div>
      </div>
    </div>
  );
}
