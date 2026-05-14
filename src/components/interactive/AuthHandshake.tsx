"use client";
import { useState } from "react";
import { motion } from "motion/react";

const STEPS = [
  { from: "node", to: "portal", label: "GET /auth/start", detail: "node opens browser to mesh auth portal with PKCE challenge" },
  { from: "portal", to: "user", label: "sign-in form", detail: "superadmin authenticates with mesh credentials" },
  { from: "user", to: "portal", label: "credentials", detail: "superadmin completes the flow in the portal UI" },
  { from: "portal", to: "node", label: "session token", detail: "portal redirects with one-time session for this node" },
  { from: "node", to: "node", label: "generate keypair", detail: "node creates an Ed25519 keypair and stores private key in OS keystore" },
  { from: "node", to: "portal", label: "POST /auth/seal", detail: "node trades the session for a long-lived `lifetime auth usage` bound to its public key" },
  { from: "portal", to: "node", label: "sealed identity", detail: "portal returns a node identity certificate signed by the mesh CA" },
  { from: "node", to: "mesh", label: "signed control call", detail: "every future mesh call carries a signature verifiable by all peers" },
];

const COL = { node: 80, portal: 240, user: 400, mesh: 240 } as const;
type Actor = keyof typeof COL;

export function AuthHandshake() {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const yFor = (i: number) => 70 + i * 38;

  return (
    <div className="my-6 grid gap-4 rounded-xl border border-border bg-surface/40 p-5 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-soft">Auth sequence</div>
        <svg viewBox="0 0 480 380" className="w-full">
          {(["node", "portal", "user"] as Actor[]).map((a) => (
            <g key={a}>
              <rect x={COL[a] - 50} y={20} width={100} height={28} rx={6} fill="oklch(0.22 0.04 282)" stroke="oklch(0.3 0.04 282)" />
              <text x={COL[a]} y={38} textAnchor="middle" fontSize="11" fill="oklch(0.94 0.02 280)" fontFamily="var(--font-mono)">{a}</text>
              <line x1={COL[a]} y1={50} x2={COL[a]} y2={360} stroke="oklch(0.3 0.04 282)" strokeDasharray="3 4" />
            </g>
          ))}
          {STEPS.map((st, i) => {
            const y = yFor(i);
            const x1 = COL[st.from as Actor];
            const x2 = COL[st.to as Actor];
            const active = i === step;
            const past = i < step;
            const opacity = active ? 1 : past ? 0.45 : 0.2;
            if (st.from === st.to) {
              return (
                <g key={i} opacity={opacity}>
                  <path d={`M ${x1 + 6} ${y - 6} q 30 -6 30 14 q 0 18 -30 8`} stroke="oklch(0.66 0.21 282)" fill="none" strokeWidth={active ? 1.6 : 1} />
                  <text x={x1 + 44} y={y + 8} fontSize="10" fill="oklch(0.78 0.13 282)" fontFamily="var(--font-mono)">{st.label}</text>
                </g>
              );
            }
            const dir = x2 > x1 ? 1 : -1;
            return (
              <g key={i} opacity={opacity}>
                <line x1={x1 + 6 * dir} y1={y} x2={x2 - 8 * dir} y2={y} stroke={active ? "oklch(0.78 0.16 195)" : "oklch(0.66 0.21 282)"} strokeWidth={active ? 1.8 : 1} />
                <polygon
                  points={`${x2 - 8 * dir},${y - 4} ${x2},${y} ${x2 - 8 * dir},${y + 4}`}
                  fill={active ? "oklch(0.78 0.16 195)" : "oklch(0.66 0.21 282)"}
                />
                <text x={(x1 + x2) / 2} y={y - 5} textAnchor="middle" fontSize="10" fill="oklch(0.78 0.13 282)" fontFamily="var(--font-mono)">
                  {st.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-col">
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-soft">Step {step + 1} of {STEPS.length}</div>
        <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex-1 rounded-lg border border-border bg-[var(--code-bg)] p-4">
          <div className="font-display text-lg font-semibold">{s.label}</div>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
            {s.from} → {s.to}
          </div>
          <p className="mt-3 text-[14px] text-foreground/85">{s.detail}</p>
        </motion.div>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setStep((i) => Math.max(0, i - 1))} className="rounded-md border border-border px-3 py-1.5 text-[12px]">← prev</button>
          <button onClick={() => setStep((i) => Math.min(STEPS.length - 1, i + 1))} className="rounded-md bg-primary px-3 py-1.5 text-[12px] text-primary-foreground">next →</button>
          <button onClick={() => setStep(0)} className="ml-auto rounded-md border border-border px-3 py-1.5 text-[12px]">reset</button>
        </div>
      </div>
    </div>
  );
}
