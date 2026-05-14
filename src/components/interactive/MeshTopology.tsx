"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";

type Node = {
  id: string;
  x: number;
  y: number;
  load: number;
  capacity: number;
  region: string;
};

function makeNodes(n: number, seed = 7): Node[] {
  // Deterministic ring layout with jitter.
  const out: Node[] = [];
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const regions = ["us-e", "us-w", "eu", "ap"];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 110 + rand() * 40;
    out.push({
      id: `n${i}`,
      x: 200 + Math.cos(a) * r,
      y: 200 + Math.sin(a) * r,
      load: rand(),
      capacity: 0.4 + rand() * 0.6,
      region: regions[i % regions.length],
    });
  }
  return out;
}

export function MeshTopology({
  defaultSize = 14,
  showControls = true,
}: {
  defaultSize?: number;
  showControls?: boolean;
}) {
  const [size, setSize] = useState(defaultSize);
  const [self] = useState(0);
  const [budget, setBudget] = useState(120);
  const nodes = useMemo(() => makeNodes(size), [size]);
  const me = nodes[self];

  // peers = top-k by score relative to me
  const k = Math.max(2, Math.ceil(2 + Math.log2(size)));
  const ranked = nodes
    .map((n, i) => {
      if (i === self) return { i, score: Infinity };
      const dx = n.x - me.x;
      const dy = n.y - me.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const latency = dist / 2; // fake ms
      const overBudget = latency > budget ? 1 : 0;
      const score = 0.45 * (latency / 200) + 0.2 * n.load + 0.2 * (1 - n.capacity) + 0.15 * overBudget;
      return { i, score, latency };
    })
    .sort((a, b) => a.score - b.score);
  const peers = new Set(ranked.slice(1, 1 + k).map((r) => r.i));

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-border bg-surface/40">
      <svg viewBox="0 0 400 400" className="block w-full grid-bg">
        {/* peer edges */}
        {[...peers].map((i) => (
          <line
            key={`e${i}`}
            x1={me.x}
            y1={me.y}
            x2={nodes[i].x}
            y2={nodes[i].y}
            stroke="oklch(0.66 0.21 282)"
            strokeOpacity="0.55"
            strokeWidth={1.4}
          />
        ))}
        {/* candidate (non-peer) faint edges */}
        {nodes.map((n, i) =>
          i === self || peers.has(i) ? null : (
            <line
              key={`f${i}`}
              x1={me.x}
              y1={me.y}
              x2={n.x}
              y2={n.y}
              stroke="oklch(0.78 0.16 195)"
              strokeOpacity="0.06"
              strokeWidth={1}
            />
          )
        )}
        {nodes.map((n, i) => {
          const isMe = i === self;
          const isPeer = peers.has(i);
          return (
            <g key={n.id}>
              {isMe && (
                <motion.circle
                  cx={n.x}
                  cy={n.y}
                  r={18}
                  fill="oklch(0.66 0.21 282)"
                  fillOpacity="0.18"
                  animate={{ r: [18, 28, 18], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2.4, repeat: Infinity }}
                />
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r={isMe ? 9 : isPeer ? 6.5 : 4.5}
                fill={isMe ? "oklch(0.78 0.16 195)" : isPeer ? "oklch(0.78 0.13 282)" : "oklch(0.5 0.04 282)"}
                stroke={isMe ? "oklch(0.78 0.16 195)" : "oklch(0.3 0.04 282)"}
                strokeWidth={1}
              />
              <text
                x={n.x}
                y={n.y - 12}
                textAnchor="middle"
                fontSize="9"
                fill="oklch(0.7 0.04 280)"
                fontFamily="var(--font-mono)"
              >
                {n.region}
              </text>
            </g>
          );
        })}
      </svg>
      {showControls && (
        <div className="grid gap-4 border-t border-border/60 p-4 sm:grid-cols-3">
          <Control
            label={`Fleet size: ${size}`}
            sub={`target peer degree k = ⌈2 + log₂(N)⌉ = ${k}`}
            value={size}
            min={4}
            max={48}
            onChange={setSize}
          />
          <Control
            label={`Latency budget: ${budget} ms`}
            sub="links over budget are penalized"
            value={budget}
            min={40}
            max={300}
            onChange={setBudget}
          />
          <div className="flex flex-col justify-center rounded-lg border border-border/60 bg-surface/60 p-3 text-xs">
            <div className="mb-2 text-muted-foreground">Legend</div>
            <Legend swatch="oklch(0.78 0.16 195)" label="self" />
            <Legend swatch="oklch(0.78 0.13 282)" label="chosen peer" />
            <Legend swatch="oklch(0.5 0.04 282)" label="candidate" />
          </div>
        </div>
      )}
    </div>
  );
}

function Control({
  label,
  sub,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  sub?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface/60 p-3">
      <div className="mb-1 text-xs font-medium text-foreground">{label}</div>
      {sub && <div className="mb-2 text-[11px] text-muted-foreground">{sub}</div>}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full accent-[var(--indigo)]"
      />
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-[11px] text-foreground/80">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: swatch }} />
      {label}
    </div>
  );
}
