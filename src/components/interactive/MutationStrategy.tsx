"use client";
import { useState } from "react";

const NODES = ["node-a", "node-b", "node-c", "node-d"];

type Strategy = "owner" | "quorum" | "broadcast";

export function MutationStrategy() {
  const [strat, setStrat] = useState<Strategy>("owner");
  const owner = "node-b";

  const effects: Record<Strategy, { reach: string[]; explain: string; ack: string }> = {
    owner: {
      reach: [owner],
      explain: "Write hits the entity's owner node. Other nodes learn via change-stream replication.",
      ack: "ack returned after owner durably persists",
    },
    quorum: {
      reach: ["node-a", "node-b", "node-c"],
      explain: "Coordinator forwards to a write quorum (majority of replicas). Survives one node loss.",
      ack: "ack returned after ⌈N/2⌉+1 nodes persist",
    },
    broadcast: {
      reach: NODES,
      explain: "Fan-out write to every node. Used for system-wide config and registry updates.",
      ack: "ack returned after every reachable node persists",
    },
  };
  const e = effects[strat];

  return (
    <div className="my-6 rounded-xl border border-border bg-surface/40 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-indigo-soft">Mutation strategy</div>
        <div className="flex gap-1 rounded-md border border-border bg-surface p-1 text-[12px]">
          {(["owner", "quorum", "broadcast"] as Strategy[]).map((s) => (
            <button
              key={s}
              onClick={() => setStrat(s)}
              className={"rounded px-3 py-1 transition " + (strat === s ? "bg-indigo/20 text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <svg viewBox="0 0 320 220" className="w-full grid-bg rounded-lg">
          <circle cx="160" cy="40" r="14" fill="oklch(0.66 0.21 282)" />
          <text x="160" y="44" textAnchor="middle" fontSize="9" fill="white" fontFamily="var(--font-mono)">client</text>
          {NODES.map((n, i) => {
            const x = 50 + (i % 2) * 220;
            const y = 130 + Math.floor(i / 2) * 60;
            const reached = e.reach.includes(n);
            const isOwner = n === owner;
            return (
              <g key={n}>
                <line x1="160" y1="54" x2={x} y2={y} stroke={reached ? "oklch(0.78 0.16 195)" : "oklch(0.3 0.04 282)"} strokeWidth={reached ? 1.6 : 1} strokeDasharray={reached ? "0" : "3 4"} />
                <circle cx={x} cy={y} r="14" fill={reached ? "oklch(0.78 0.13 282)" : "oklch(0.22 0.04 282)"} stroke={isOwner ? "oklch(0.78 0.16 195)" : "oklch(0.3 0.04 282)"} strokeWidth={isOwner ? 2 : 1} />
                <text x={x} y={y + 4} textAnchor="middle" fontSize="9" fill="white" fontFamily="var(--font-mono)">{n}</text>
                {isOwner && <text x={x} y={y + 28} textAnchor="middle" fontSize="9" fill="oklch(0.78 0.16 195)" fontFamily="var(--font-mono)">owner</text>}
              </g>
            );
          })}
        </svg>
        <div className="rounded-lg border border-border/60 bg-surface/60 p-4">
          <div className="font-display text-sm font-semibold capitalize">{strat} write</div>
          <p className="mt-2 text-[13px] text-foreground/85">{e.explain}</p>
          <div className="mt-3 rounded-md border border-emerald/30 bg-emerald/10 px-3 py-2 font-mono text-[11px] text-emerald">
            ✓ {e.ack}
          </div>
        </div>
      </div>
    </div>
  );
}
