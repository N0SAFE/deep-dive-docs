"use client";
import { useMemo, useState } from "react";

type Entity = "deployments" | "logs" | "metrics" | "replicas" | "events";

const ENTITIES: { id: Entity; cols: string[] }[] = [
  { id: "deployments", cols: ["id", "name", "status", "environment", "ownerNode", "createdAt"] },
  { id: "logs", cols: ["id", "deploymentId", "level", "message", "ts"] },
  { id: "metrics", cols: ["id", "deploymentId", "cpu", "mem", "rps", "ts"] },
  { id: "replicas", cols: ["id", "deploymentId", "node", "state"] },
  { id: "events", cols: ["id", "deploymentId", "type", "payload", "ts"] },
];

export function QueryPlayground() {
  const [from, setFrom] = useState<Entity>("deployments");
  const [whereStatus, setWhereStatus] = useState<"any" | "running" | "failed">("running");
  const [whereEnv, setWhereEnv] = useState<"any" | "prod" | "staging">("prod");
  const [select, setSelect] = useState<string[]>(["id", "name", "status"]);
  const [orderBy, setOrderBy] = useState<string>("createdAt");
  const [limit, setLimit] = useState(20);
  const [join, setJoin] = useState<Entity | "none">("metrics");

  const cols = ENTITIES.find((e) => e.id === from)!.cols;

  const code = useMemo(() => {
    const wh: string[] = [];
    if (whereStatus !== "any") wh.push(`    status: "${whereStatus}",`);
    if (whereEnv !== "any") wh.push(`    environment: "${whereEnv}",`);
    const lines = [
      `discovery`,
      `  .from(DeploymentMeshService.methods.${from})`,
      ...(wh.length ? [`  .where({`, ...wh, `  })`] : []),
      `  .select([${select.map((s) => `"${s}"`).join(", ")}])`,
    ];
    if (join !== "none") {
      lines.push(
        `  .join(`,
        `    discovery.from(DeploymentMeshService.methods.${join}),`,
        `    (d, j) => eq(d.id, j.deploymentId),`,
        `  )`
      );
    }
    lines.push(`  .orderBy("${orderBy}", "desc")`, `  .limit(${limit});`);
    return lines.join("\n");
  }, [from, whereStatus, whereEnv, select, orderBy, limit, join]);

  const plan = useMemo(() => {
    const stages: { label: string; sub: string; color: string }[] = [
      { label: "discover", sub: `topic: ${from}.list`, color: "indigo" },
      { label: "fanout", sub: `→ k peers in parallel`, color: "indigo" },
      { label: "scan", sub: `${from} on each peer`, color: "teal" },
      ...(whereStatus !== "any" || whereEnv !== "any"
        ? [{ label: "filter", sub: "pushdown predicates", color: "teal" }]
        : []),
      ...(join !== "none"
        ? [{ label: "join", sub: `${from} ⋈ ${join} on deploymentId`, color: "amber" }]
        : []),
      { label: "project", sub: `select ${select.length} cols`, color: "amber" },
      { label: "merge", sub: "stream-merge results", color: "indigo" },
      { label: "dedup", sub: "by primary key", color: "indigo" },
      { label: "order+limit", sub: `orderBy ${orderBy} desc, limit ${limit}`, color: "teal" },
    ];
    return stages;
  }, [from, whereStatus, whereEnv, join, orderBy, limit, select.length]);

  return (
    <div className="my-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <div className="rounded-xl border border-border bg-surface/40 p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-soft">
          Build a query
        </div>
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <Field label="from">
            <select className="select" value={from} onChange={(e) => { setFrom(e.target.value as Entity); setSelect(ENTITIES.find(en=>en.id===e.target.value)!.cols.slice(0,3)); }}>
              {ENTITIES.map((e) => <option key={e.id} value={e.id}>{e.id}</option>)}
            </select>
          </Field>
          <Field label="join with">
            <select className="select" value={join} onChange={(e) => setJoin(e.target.value as Entity | "none")}>
              <option value="none">— none —</option>
              {ENTITIES.filter((e) => e.id !== from).map((e) => <option key={e.id} value={e.id}>{e.id}</option>)}
            </select>
          </Field>
          <Field label="where status">
            <select className="select" value={whereStatus} onChange={(e) => setWhereStatus(e.target.value as typeof whereStatus)}>
              <option value="any">any</option>
              <option value="running">running</option>
              <option value="failed">failed</option>
            </select>
          </Field>
          <Field label="where environment">
            <select className="select" value={whereEnv} onChange={(e) => setWhereEnv(e.target.value as typeof whereEnv)}>
              <option value="any">any</option>
              <option value="prod">prod</option>
              <option value="staging">staging</option>
            </select>
          </Field>
          <Field label="orderBy">
            <select className="select" value={orderBy} onChange={(e) => setOrderBy(e.target.value)}>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={`limit: ${limit}`}>
            <input type="range" min={1} max={100} value={limit} onChange={(e) => setLimit(+e.target.value)} className="w-full accent-[var(--indigo)]" />
          </Field>
        </div>

        <div className="mt-4">
          <div className="mb-1 text-[12px] text-muted-foreground">select</div>
          <div className="flex flex-wrap gap-1.5">
            {cols.map((c) => {
              const on = select.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => setSelect(on ? select.filter((s) => s !== c) : [...select, c])}
                  className={
                    "rounded-md border px-2 py-1 font-mono text-[11px] transition " +
                    (on
                      ? "border-indigo/50 bg-indigo/15 text-foreground"
                      : "border-border/60 bg-surface text-muted-foreground hover:text-foreground")
                  }
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <pre className="mt-4 overflow-x-auto rounded-lg border border-border/60 bg-[var(--code-bg)] p-3 text-[12px] leading-[1.6] text-foreground/90">
{code}
        </pre>
      </div>

      <div className="rounded-xl border border-border bg-surface/40 p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-soft">
          Generated plan
        </div>
        <ol className="space-y-2">
          {plan.map((p, i) => (
            <li key={i} className="flex items-start gap-3 rounded-md border border-border/60 bg-surface/60 px-3 py-2">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-mono text-muted-foreground">{i + 1}</span>
              <div className="flex-1">
                <div className="font-display text-[13px] font-semibold" style={{ color: `var(--${p.color})` }}>{p.label}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{p.sub}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <style>{`
        .select {
          width:100%;
          background: var(--code-bg);
          border:1px solid var(--border);
          border-radius:6px;
          padding:6px 8px;
          color: var(--foreground);
          font-family: var(--font-mono);
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
