"use client";
import { useMemo, useState } from "react";
import { Math as TeX } from "@/components/doc/Math";

type Cand = { id: string; lat: number; jitter: number; queue: number; mem: number; cap: number; fail: number };

const SEED: Cand[] = [
  { id: "node-a", lat: 22, jitter: 3, queue: 0.1, mem: 0.3, cap: 0.9, fail: 0 },
  { id: "node-b", lat: 48, jitter: 8, queue: 0.4, mem: 0.5, cap: 0.7, fail: 0.05 },
  { id: "node-c", lat: 110, jitter: 14, queue: 0.2, mem: 0.4, cap: 0.6, fail: 0 },
  { id: "node-d", lat: 75, jitter: 22, queue: 0.7, mem: 0.8, cap: 0.4, fail: 0.2 },
  { id: "node-e", lat: 35, jitter: 5, queue: 0.25, mem: 0.45, cap: 0.85, fail: 0 },
  { id: "node-f", lat: 180, jitter: 30, queue: 0.5, mem: 0.6, cap: 0.55, fail: 0.1 },
  { id: "node-g", lat: 60, jitter: 11, queue: 0.35, mem: 0.55, cap: 0.75, fail: 0 },
];

const norm = (v: number, max: number) => Math.min(1, Math.max(0, v / max));

export function PeerScoreCalculator() {
  const [wL, setWL] = useState(0.45);
  const [wJ, setWJ] = useState(0.1);
  const [wQ, setWQ] = useState(0.15);
  const [wS, setWS] = useState(0.05);
  const [wM, setWM] = useState(0.05);
  const [wF, setWF] = useState(0.1);
  const [wC, setWC] = useState(0.1);
  const [budget, setBudget] = useState(150);
  const [N, setN] = useState(24);

  const sumW = wL + wJ + wQ + wS + wM + wF + wC;

  const ranked = useMemo(() => {
    return SEED.map((c) => {
      const L = norm(c.lat, budget);
      const J = norm(c.jitter, 40);
      const Q = c.queue;
      const S = norm(c.queue * 0.8, 1); // proxy
      const M = c.mem;
      const F = c.fail;
      const C = c.cap;
      const score = wL * L + wJ * J + wQ * Q + wS * S + wM * M + wF * F + wC * (1 - C);
      return { ...c, score, L, C };
    }).sort((a, b) => a.score - b.score);
  }, [wL, wJ, wQ, wS, wM, wF, wC, budget]);

  const medL = ranked[Math.floor(ranked.length / 2)].L;
  const medC = ranked.reduce((s, r) => s + r.C, 0) / ranked.length;
  const Kbase = Math.ceil(2 + Math.log2(Math.max(2, N)));
  const Kcap = Math.ceil(Kbase * (0.6 + 0.4 * medC));
  const Klat = Math.ceil(Kbase * (1 - medL));
  const k = Math.max(3, Math.min(8, Math.max(Kbase, Kcap, Klat)));
  const chosen = new Set(ranked.slice(0, k).map((r) => r.id));

  return (
    <div className="my-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-xl border border-border bg-surface/40 p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-soft">
          Score weights
        </div>
        <div className="space-y-3">
          {[
            ["w_L · latency", wL, setWL],
            ["w_J · jitter", wJ, setWJ],
            ["w_Q · queue backlog", wQ, setWQ],
            ["w_S · stream load", wS, setWS],
            ["w_M · memory pressure", wM, setWM],
            ["w_F · failure penalty", wF, setWF],
            ["w_C · capacity (inverted)", wC, setWC],
          ].map(([label, v, set]) => {
            const setter = set as (n: number) => void;
            return (
              <div key={label as string}>
                <div className="mb-1 flex justify-between text-[12px]">
                  <span className="text-muted-foreground">{label as string}</span>
                  <span className="font-mono text-foreground">{(v as number).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={v as number}
                  onChange={(e) => setter(+e.target.value)}
                  className="w-full accent-[var(--indigo)]"
                />
              </div>
            );
          })}
          <div
            className={
              "mt-2 rounded-md border px-3 py-2 text-[11px] " +
              (Math.abs(sumW - 1) < 0.01
                ? "border-emerald/30 bg-emerald/10 text-emerald"
                : "border-amber/30 bg-amber/10 text-amber")
            }
          >
            Σ w = {sumW.toFixed(2)} {Math.abs(sumW - 1) < 0.01 ? "✓ balanced" : "(not normalized)"}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <NumField label={`Latency budget (ms): ${budget}`} value={budget} min={50} max={400} step={10} onChange={setBudget} />
            <NumField label={`Fleet size N: ${N}`} value={N} min={3} max={64} step={1} onChange={setN} />
          </div>
        </div>

        <div className="mt-4 rounded-md border border-border/60 bg-[var(--code-bg)] p-3 text-xs">
          <div className="mb-1 text-muted-foreground">Computed peer degree</div>
          <TeX block tex={`K_{base} = \\lceil 2 + \\log_2(${N}) \\rceil = ${Kbase}`} />
          <TeX block tex={`K_{cap} = \\lceil K_{base}(0.6 + 0.4\\,\\bar{C}) \\rceil = ${Kcap}`} />
          <TeX block tex={`K_{lat} = \\lceil K_{base}(1 - \\tilde{L}/L_{budget}) \\rceil = ${Klat}`} />
          <div className="mt-1 font-mono text-foreground">
            k = clamp(3, 8, max) = <span className="text-teal">{k}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface/40 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-widest text-indigo-soft">Ranked candidates</div>
          <div className="text-[11px] text-muted-foreground">picked top {k}</div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <table className="w-full text-[12px]">
            <thead className="bg-surface-2/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">node</th>
                <th className="px-2 py-2 text-right">lat</th>
                <th className="px-2 py-2 text-right">jit</th>
                <th className="px-2 py-2 text-right">cap</th>
                <th className="px-2 py-2 text-right">fail</th>
                <th className="px-3 py-2 text-right">score</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr
                  key={r.id}
                  className={
                    "border-t border-border/40 " + (chosen.has(r.id) ? "bg-indigo/10" : "")
                  }
                >
                  <td className="px-3 py-1.5 font-mono">
                    {chosen.has(r.id) && <span className="mr-1 text-indigo-soft">●</span>}
                    {r.id}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{r.lat}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{r.jitter}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{r.cap.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{r.fail.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-teal">{r.score.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground">
          Lower score is better. Highlighted rows form the active peer set after ranking, latency budget, and the computed
          peer degree are applied.
        </p>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[12px] text-muted-foreground">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full accent-[var(--indigo)]"
      />
    </div>
  );
}
