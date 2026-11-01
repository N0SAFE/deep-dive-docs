"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, RotateCcw, Wifi, WifiOff, Radio, Activity } from "lucide-react";

/* ─── Types ─── */
type MeshNode = {
  id: string;
  label: string;
  region: string;
  x: number;
  y: number;
  online: boolean;
};

type LinkMetric = {
  latencyMs: number;
  throughputMbps: number;
  weight: number;
};

type MeshEdge = {
  id: string;
  source: string;
  target: string;
  selected: boolean;
  bypass: boolean;
  metric: LinkMetric;
};

/* ─── Helpers ─── */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const pickRandom = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]!;

const computeWeight = (latencyMs: number, throughputMbps: number) => {
  const latencyNorm = clamp(latencyMs / 250, 0, 1);
  const throughputNorm = clamp(throughputMbps / 1500, 0, 1);
  return Number((0.7 * latencyNorm + 0.3 * (1 - throughputNorm)).toFixed(3));
};

const weightToColor = (w: number) => {
  if (w <= 0.2) return "#059669";
  if (w <= 0.35) return "#0891b2";
  if (w <= 0.5) return "#2563eb";
  if (w <= 0.7) return "#d97706";
  return "#dc2626";
};

const hashStr = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

const deriveMetric = (edgeId: string, source: string, target: string): LinkMetric => {
  const seed = hashStr(`${edgeId}:${source}:${target}`);
  const latencyMs = 8 + (seed % 72);
  const throughputMbps = 480 + (seed % 1120);
  return { latencyMs, throughputMbps, weight: computeWeight(latencyMs, throughputMbps) };
};

/* ─── MST + min-degree-2 + bypass ─── */
const findRoot = (parent: Map<string, string>, x: string): string => {
  const p = parent.get(x);
  if (!p || p === x) { parent.set(x, x); return x; }
  const r = findRoot(parent, p);
  parent.set(x, r);
  return r;
};

const unionRoots = (parent: Map<string, string>, rank: Map<string, number>, a: string, b: string) => {
  const ra = findRoot(parent, a), rb = findRoot(parent, b);
  if (ra === rb) return false;
  const la = rank.get(ra) ?? 0, lb = rank.get(rb) ?? 0;
  if (la < lb) parent.set(ra, rb);
  else if (la > lb) parent.set(rb, ra);
  else { parent.set(rb, ra); rank.set(ra, la + 1); }
  return true;
};

const dijkstra = (nodeIds: string[], edges: { source: string; target: string; weight: number }[], src: string, tgt: string): number => {
  const adj = new Map<string, { nodeId: string; cost: number }[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) {
    adj.get(e.source)?.push({ nodeId: e.target, cost: e.weight });
    adj.get(e.target)?.push({ nodeId: e.source, cost: e.weight });
  }
  const dist = new Map<string, number>(nodeIds.map(id => [id, Infinity]));
  dist.set(src, 0);
  const visited = new Set<string>();
  while (visited.size < nodeIds.length) {
    let cur: string | null = null, best = Infinity;
    for (const id of nodeIds) {
      if (visited.has(id)) continue;
      const d = dist.get(id) ?? Infinity;
      if (d < best) { best = d; cur = id; }
    }
    if (!cur || best === Infinity) break;
    if (cur === tgt) return best;
    visited.add(cur);
    for (const next of adj.get(cur) ?? []) {
      if (visited.has(next.nodeId)) continue;
      const proposal = best + next.cost;
      if (proposal < (dist.get(next.nodeId) ?? Infinity)) dist.set(next.nodeId, proposal);
    }
  }
  return dist.get(tgt) ?? Infinity;
};

const selectRuleBasedEdges = (nodeIds: string[], candidateEdges: { id: string; source: string; target: string; weight: number }[]) => {
  const selected = new Set<string>();
  const bypass = new Set<string>();
  if (nodeIds.length <= 1) return { selected, bypass };

  const ranked = [...candidateEdges].sort((a, b) => a.weight - b.weight);
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();
  const degree = new Map<string, number>();
  for (const id of nodeIds) { parent.set(id, id); rank.set(id, 0); degree.set(id, 0); }

  // Rule 1: MST
  for (const edge of ranked) {
    if (unionRoots(parent, rank, edge.source, edge.target)) {
      selected.add(edge.id);
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    }
  }

  // Rule 2: min-degree 2
  for (const id of nodeIds) {
    while ((degree.get(id) ?? 0) < 2) {
      const alt = ranked.find(e => (e.source === id || e.target === id) && !selected.has(e.id));
      if (!alt) break;
      selected.add(alt.id);
      degree.set(alt.source, (degree.get(alt.source) ?? 0) + 1);
      degree.set(alt.target, (degree.get(alt.target) ?? 0) + 1);
    }
  }

  // Rule 3: bypass (20% faster)
  const selectedEdges = candidateEdges.filter(e => selected.has(e.id));
  for (const edge of ranked) {
    if (selected.has(edge.id)) continue;
    const routed = dijkstra(nodeIds, selectedEdges.map(e => ({ source: e.source, target: e.target, weight: e.weight })), edge.source, edge.target);
    if (Number.isFinite(routed) && edge.weight * 1.2 < routed) {
      selected.add(edge.id);
      bypass.add(edge.id);
    }
  }

  return { selected, bypass };
};

/* ─── Initial nodes ─── */
const REGIONS = ["us-e", "us-w", "eu", "ap"];
const INITIAL_NODES: MeshNode[] = Array.from({ length: 10 }, (_, i) => {
  const a = (Math.PI * 2 * i) / 10;
  return {
    id: `api-${i + 1}`,
    label: `API-${i + 1}`,
    region: REGIONS[i % REGIONS.length],
    x: 300 + Math.cos(a) * 160,
    y: 200 + Math.sin(a) * 160,
    online: true,
  };
});

/* ─── Component ─── */
export function MeshTopologyLive() {
  const [nodes, setNodes] = useState<MeshNode[]>(INITIAL_NODES);
  const [metrics, setMetrics] = useState<Record<string, LinkMetric>>({});
  const [simRunning, setSimRunning] = useState(true);
  const [tick, setTick] = useState(0);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [requestPath, setRequestPath] = useState<string[]>([]);
  const [requestPlaying, setRequestPlaying] = useState(false);
  const [requestStep, setRequestStep] = useState(0);
  const requestTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live simulation: nodes join/leave, metrics drift
  useEffect(() => {
    if (!simRunning) return;
    const interval = setInterval(() => {
      setNodes(prev => {
        const next = prev.map(n => ({ ...n }));
        const online = next.filter(n => n.online);
        const offline = next.filter(n => !n.online);

        // 22% chance a node drops
        if (Math.random() < 0.22 && online.length > 6) {
          const drop = pickRandom(online);
          const idx = next.findIndex(n => n.id === drop.id);
          if (idx >= 0) next[idx]!.online = false;
        }
        // 35% chance a node joins
        if (Math.random() < 0.35 && offline.length > 0) {
          const join = pickRandom(offline);
          const idx = next.findIndex(n => n.id === join.id);
          if (idx >= 0) next[idx]!.online = true;
        }
        return next;
      });

      setMetrics(prev => {
        const next: Record<string, LinkMetric> = {};
        for (let i = 0; i < 10; i++) {
          for (let j = i + 1; j < 10; j++) {
            const id = `mesh-api-${i + 1}__api-${j + 1}`;
            const base = prev[id] ?? deriveMetric(id, `api-${i + 1}`, `api-${j + 1}`);
            const lat = clamp(base.latencyMs + (Math.random() * 26 - 13), 6, 220);
            const tp = clamp(base.throughputMbps + (Math.random() * 180 - 90), 180, 1800);
            next[id] = { latencyMs: Math.round(lat), throughputMbps: Math.round(tp), weight: computeWeight(lat, tp) };
          }
        }
        return next;
      });

      setTick(t => t + 1);
    }, 1300);
    return () => clearInterval(interval);
  }, [simRunning]);

  // Compute edges with rule-based selection
  const { edges, onlineCount } = useMemo(() => {
    const onlineNodes = nodes.filter(n => n.online);
    const onlineIds = onlineNodes.map(n => n.id);
    const onlineSet = new Set(onlineIds);

    // Candidate edges between all online pairs
    const candidates: { id: string; source: string; target: string; weight: number }[] = [];
    for (let i = 0; i < 10; i++) {
      for (let j = i + 1; j < 10; j++) {
        const si = `api-${i + 1}`, sj = `api-${j + 1}`;
        if (!onlineSet.has(si) || !onlineSet.has(sj)) continue;
        const id = `mesh-${si}__${sj}`;
        const m = metrics[id] ?? deriveMetric(id, si, sj);
        candidates.push({ id, source: si, target: sj, weight: m.weight });
      }
    }

    const { selected, bypass } = selectRuleBasedEdges(onlineIds, candidates);

    const result: MeshEdge[] = candidates
      .filter(c => selected.has(c.id))
      .map(c => ({
        id: c.id,
        source: c.source,
        target: c.target,
        selected: true,
        bypass: bypass.has(c.id),
        metric: metrics[c.id] ?? deriveMetric(c.id, c.source, c.target),
      }));

    return { edges: result, onlineCount: onlineNodes.length };
  }, [nodes, metrics, tick]);

  // Find shortest path for request builder
  const findPath = useCallback((src: string, tgt: string): string[] => {
    if (src === tgt) return [src];
    const onlineSet = new Set(nodes.filter(n => n.online).map(n => n.id));
    if (!onlineSet.has(src) || !onlineSet.has(tgt)) return [];

    const adj = new Map<string, { nodeId: string; weight: number }[]>();
    for (const n of nodes) if (n.online) adj.set(n.id, []);
    for (const e of edges) {
      const m = e.metric;
      adj.get(e.source)?.push({ nodeId: e.target, weight: m.weight });
      adj.get(e.target)?.push({ nodeId: e.source, weight: m.weight });
    }

    const dist = new Map<string, number>(nodes.filter(n => n.online).map(n => [n.id, Infinity]));
    const prev = new Map<string, string | null>();
    dist.set(src, 0);
    const visited = new Set<string>();

    while (visited.size < adj.size) {
      let cur: string | null = null, best = Infinity;
      for (const [id, d] of dist) {
        if (visited.has(id)) continue;
        if (d < best) { best = d; cur = id; }
      }
      if (!cur || best === Infinity) break;
      visited.add(cur);
      for (const next of adj.get(cur) ?? []) {
        const proposal = best + next.weight;
        if (proposal < (dist.get(next.nodeId) ?? Infinity)) {
          dist.set(next.nodeId, proposal);
          prev.set(next.nodeId, cur);
        }
      }
    }

    const path: string[] = [];
    let cur: string | null = tgt;
    while (cur) { path.unshift(cur); cur = prev.get(cur) ?? null; }
    if (path[0] !== src) return [];
    return path;
  }, [nodes, edges]);

  // Animate request path
  useEffect(() => {
    if (!requestPlaying || requestPath.length < 2) return;
    requestTimerRef.current = setInterval(() => {
      setRequestStep(s => {
        if (s >= requestPath.length - 1) {
          setRequestPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 600);
    return () => { if (requestTimerRef.current) clearInterval(requestTimerRef.current); };
  }, [requestPlaying, requestPath.length]);

  const handleSendRequest = () => {
    if (!selectedSource || !selectedTarget || selectedSource === selectedTarget) return;
    const path = findPath(selectedSource, selectedTarget);
    if (path.length === 0) return;
    setRequestPath(path);
    setRequestStep(0);
    setRequestPlaying(true);
  };

  const onlineNodes = nodes.filter(n => n.online);
  const offlineNodes = nodes.filter(n => !n.online);

  // Build edge path segments for request animation
  const requestEdgeIds = useMemo(() => {
    const ids: string[] = [];
    for (let i = 0; i < requestPath.length - 1; i++) {
      const a = requestPath[i]!, b = requestPath[i + 1]!;
      const pair = [a, b].sort().join("__");
      ids.push(`mesh-${pair}`);
    }
    return ids;
  }, [requestPath]);

  return (
    <div className="my-8 overflow-hidden rounded-xl border border-border bg-surface/30 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-surface/50">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold">Live Mesh Simulation</h3>
          <span className="text-[11px] text-muted-foreground">
            {onlineCount}/{nodes.length} nodes online
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSimRunning(!simRunning)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              simRunning ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
            }`}
          >
            {simRunning ? <><Wifi className="w-3.5 h-3.5" /> Live</> : <><WifiOff className="w-3.5 h-3.5" /> Paused</>}
          </button>
          <button
            onClick={() => { setNodes(INITIAL_NODES.map(n => ({ ...n }))); setMetrics({}); }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs hover:bg-muted transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Graph */}
        <div className="flex-1 min-h-105 relative bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]">
          <svg viewBox="0 0 600 400" className="absolute inset-0 w-full h-full">
            <defs>
              <marker id="mesh-arrow" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                <polygon points="0 0, 6 2, 0 4" fill="oklch(0.5 0.04 280)" />
              </marker>
              <marker id="mesh-arrow-active" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                <polygon points="0 0, 6 2, 0 4" fill="var(--indigo)" />
              </marker>
            </defs>

            {/* Edges */}
            {edges.map(e => {
              const src = nodes.find(n => n.id === e.source);
              const tgt = nodes.find(n => n.id === e.target);
              if (!src || !tgt || !src.online || !tgt.online) return null;
              const isRequestEdge = requestEdgeIds.includes(e.id);
              const color = isRequestEdge ? "var(--indigo)" : weightToColor(e.metric.weight);
              const width = isRequestEdge ? 2.5 : (1.2 + (1 - e.metric.weight) * 2.4);

              return (
                <g key={e.id}>
                  <motion.line
                    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={color}
                    strokeWidth={width}
                    strokeDasharray={e.bypass ? "6 4" : undefined}
                    markerEnd={isRequestEdge ? "url(#mesh-arrow-active)" : "url(#mesh-arrow)"}
                    opacity={isRequestEdge ? 1 : 0.6}
                    initial={false}
                    animate={{ opacity: isRequestEdge ? 1 : 0.6 }}
                    transition={{ duration: 0.3 }}
                  />
                  {/* Metric label on hover-like display for selected edges */}
                  {isRequestEdge && (
                    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <rect
                        x={(src.x + tgt.x) / 2 - 36} y={(src.y + tgt.y) / 2 - 8}
                        width="72" height="16" rx="3"
                        fill="oklch(var(--surface))" stroke="var(--indigo)" strokeWidth="0.5"
                      />
                      <text
                        x={(src.x + tgt.x) / 2} y={(src.y + tgt.y) / 2 + 3}
                        textAnchor="middle" fontSize="7" fill="var(--indigo)" className="font-mono"
                      >
                        {e.metric.latencyMs}ms · {e.metric.throughputMbps}Mbps
                      </text>
                    </motion.g>
                  )}
                </g>
              );
            })}

            {/* Request animation dot */}
            {requestPlaying && requestPath.length > 1 && requestStep < requestPath.length && (() => {
              const fromNode = nodes.find(n => n.id === requestPath[requestStep]);
              const toIdx = Math.min(requestStep + 1, requestPath.length - 1);
              const toNode = nodes.find(n => n.id === requestPath[toIdx]);
              if (!fromNode || !toNode) return null;
              return (
                <motion.circle
                  key={`req-${requestStep}`}
                  cx={fromNode.x} cy={fromNode.y} r="6"
                  fill="var(--indigo)"
                  initial={{ cx: fromNode.x, cy: fromNode.y, opacity: 0.8 }}
                  animate={{ cx: [fromNode.x, toNode.x], cy: [fromNode.y, toNode.y], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />
              );
            })()}

            {/* Nodes */}
            {nodes.map(n => {
              const isOnline = n.online;
              const isSource = selectedSource === n.id;
              const isTarget = selectedTarget === n.id;
              const isOnPath = requestPath.includes(n.id);
              const strokeColor = isSource ? "#059669" : isTarget ? "#dc2626" : isOnPath ? "var(--indigo)" : isOnline ? "oklch(0.6 0.15 250)" : "oklch(0.7 0.02 280)";
              const fillColor = !isOnline ? "oklch(0.9 0.01 280)" : isOnPath ? "oklch(0.95 0.08 280)" : "oklch(var(--surface))";

              return (
                <g key={n.id} opacity={isOnline ? 1 : 0.3}>
                  {(isOnline && (isSource || isTarget || isOnPath)) && (
                    <motion.circle
                      cx={n.x} cy={n.y} r={24}
                      fill={isSource ? "#059669" : isTarget ? "#dc2626" : "var(--indigo)"}
                      fillOpacity={0.12}
                      animate={{ r: [24, 32, 24], opacity: [0.12, 0, 0.12] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                  <rect
                    x={n.x - 28} y={n.y - 22} width="56" height="44" rx="10"
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={isSource || isTarget || isOnPath ? 2 : 1}
                  />
                  <text x={n.x} y={n.y - 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="currentColor">
                    {n.label}
                  </text>
                  <text x={n.x} y={n.y + 10} textAnchor="middle" fontSize="7" fill="oklch(var(--muted-foreground))">
                    {n.region} {isOnline ? "" : "· offline"}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Side panel */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-border/60 bg-surface/50 flex flex-col overflow-y-auto max-h-150">
          <div className="p-4 space-y-4 flex-1">
            {/* Mesh stats */}
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold mb-1">Mesh Status</div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-muted-foreground">Online:</span> <span className="font-mono font-semibold">{onlineCount}/{nodes.length}</span></div>
                <div><span className="text-muted-foreground">Links:</span> <span className="font-mono font-semibold">{edges.length}</span></div>
                <div><span className="text-muted-foreground">Bypass:</span> <span className="font-mono font-semibold">{edges.filter(e => e.bypass).length}</span></div>
                <div><span className="text-muted-foreground">Avg weight:</span> <span className="font-mono font-semibold">{edges.length ? (edges.reduce((s, e) => s + e.metric.weight, 0) / edges.length).toFixed(2) : "—"}</span></div>
              </div>
            </div>

            {/* Routing rules */}
            <div className="text-[11px] text-muted-foreground space-y-1">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-foreground mb-1">Routing Rules</div>
              <div className="flex items-start gap-1.5"><span className="text-emerald-500">1.</span> Global connectivity via MST</div>
              <div className="flex items-start gap-1.5"><span className="text-blue-500">2.</span> Min-degree ≥ 2 per node</div>
              <div className="flex items-start gap-1.5"><span className="text-purple-500">3.</span> Bypass if direct path ≥ 20% faster</div>
            </div>

            {/* Weight legend */}
            <div className="flex flex-wrap gap-2 text-[10px]">
              {[
                { w: "0–0.2", c: "#059669", l: "excellent" },
                { w: "0.2–0.35", c: "#0891b2", l: "good" },
                { w: "0.35–0.5", c: "#2563eb", l: "fair" },
                { w: "0.5–0.7", c: "#d97706", l: "degraded" },
                { w: "0.7+", c: "#dc2626", l: "poor" },
              ].map(item => (
                <div key={item.w} className="flex items-center gap-1">
                  <span className="inline-block w-3 h-1.5 rounded" style={{ background: item.c }} />
                  <span className="text-muted-foreground">{item.w} {item.l}</span>
                </div>
              ))}
            </div>

            {/* Offline nodes */}
            {offlineNodes.length > 0 && (
              <div className="p-2 rounded-md bg-red-500/10 border border-red-500/20">
                <div className="text-[10px] uppercase tracking-wider text-red-500 font-semibold mb-1">Offline Nodes</div>
                <div className="flex flex-wrap gap-1">
                  {offlineNodes.map(n => (
                    <span key={n.id} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-mono">{n.label}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Request builder */}
            <div className="p-3 rounded-lg border border-border/60 bg-surface/60">
              <div className="text-[10px] uppercase tracking-wider text-foreground font-semibold mb-2 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-500" />
                Request Path Builder
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Source node</label>
                  <select
                    value={selectedSource ?? ""}
                    onChange={e => setSelectedSource(e.target.value || null)}
                    className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5"
                  >
                    <option value="">Select source…</option>
                    {onlineNodes.map(n => <option key={n.id} value={n.id}>{n.label} ({n.region})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Target node</label>
                  <select
                    value={selectedTarget ?? ""}
                    onChange={e => setSelectedTarget(e.target.value || null)}
                    className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5"
                  >
                    <option value="">Select target…</option>
                    {onlineNodes.filter(n => n.id !== selectedSource).map(n => <option key={n.id} value={n.id}>{n.label} ({n.region})</option>)}
                  </select>
                </div>
                <button
                  onClick={handleSendRequest}
                  disabled={!selectedSource || !selectedTarget || selectedSource === selectedTarget}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition disabled:opacity-50"
                >
                  <Play className="w-3 h-3" /> Send Request
                </button>
                {requestPath.length > 1 && (
                  <div className="text-[10px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Path:</span>{" "}
                    {requestPath.map((id, i) => {
                      const n = nodes.find(n => n.id === id);
                      return (
                        <span key={id}>
                          {n?.label ?? id}
                          {i < requestPath.length - 1 && <span className="text-indigo-500 mx-0.5">→</span>}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}