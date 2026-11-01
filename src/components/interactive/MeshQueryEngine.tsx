"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play, Pause, RotateCcw, Send, Zap, AlertTriangle, CheckCircle2,
  XCircle, Clock, ArrowRight, Layers, Activity, Server, Shield,
  Eye, Shuffle, Bug, ChevronDown, ChevronUp, Trash2, X, Settings,
  Timer, Gauge, Radio, Cpu, HardDrive, Network, ArrowLeftRight, Globe,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

type NodeRegion = "us-e" | "us-w" | "eu" | "ap";
type NodeRole = "peer" | "owner" | "gateway";
type NodeStatus = "online" | "offline" | "degraded" | "joining" | "leaving";

interface MeshNode {
  id: string;
  label: string;
  region: NodeRegion;
  role: NodeRole;
  status: NodeStatus;
  x: number;
  y: number;
  load: number;
  cpuLoad: number;
  memLoad: number;
  connections: number;
  ownedResources: string[];
  uptime: number; // ticks online
  totalQueries: number;
  failedQueries: number;
}

interface LinkMetric {
  latencyMs: number;
  throughputMbps: number;
  packetLoss: number;
  weight: number;
}

interface MeshEdge {
  id: string;
  source: string;
  target: string;
  selected: boolean;
  bypass: boolean;
  metric: LinkMetric;
  status: "active" | "degraded" | "failed";
}

/* Query state machine */
type QueryPhase =
  | "idle" | "composing" | "validating" | "planning"
  | "routing" | "executing" | "streaming" | "complete" | "failed" | "retrying";

type HopStatus = "pending" | "entering" | "processing" | "exiting" | "done" | "failed" | "skipped";

interface QueryHop {
  nodeId: string;
  status: HopStatus;
  latencyMs: number;
  processingMs: number;
  event?: string;
}

interface MeshQuery {
  id: string;
  type: "read" | "write" | "subscribe" | "ownership-lookup" | "join";
  source: string;
  target: string;
  resource?: string;
  filter?: string;
  phase: QueryPhase;
  hops: QueryHop[];
  currentHopIndex: number;
  startedAt: number;
  completedAt: number | null;
  error?: string;
  retryCount: number;
  maxRetries: number;
  result?: { rows: number; latencyMs: number; fromCache: boolean; bytesTransferred: number };
  color: string;
}

/* Animated packet on an edge */
interface Packet {
  id: string;
  queryId: string;
  fromNode: string;
  toNode: string;
  progress: number; // 0-1
  color: string;
  phase: "entering" | "processing" | "exiting";
}

interface MeshEvent {
  id: string;
  tick: number;
  type: MeshEvent["type"];
  message: string;
  severity: "info" | "warn" | "error" | "success";
  nodeId?: string;
  queryId?: string;
}

interface FailureConfig {
  nodeDropChance: number;
  nodeJoinChance: number;
  degradeChance: number;
  partitionChance: number;
  metricDriftRange: number;
  ownershipTransferChance: number;
}

interface SimConfig {
  tickMs: number;
  hopDelayMs: number;
  processingDelayMs: number;
  autoQueryEnabled: boolean;
  autoQueryInterval: number;
  maxConcurrentQueries: number;
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const pickRandom = <T,>(arr: T[]) => arr.length ? arr[Math.floor(Math.random() * arr.length)]! : arr[0];
const uid = () => Math.random().toString(36).slice(2, 8);

const computeWeight = (latencyMs: number, throughputMbps: number, packetLoss: number) => {
  const latencyNorm = clamp(latencyMs / 250, 0, 1);
  const throughputNorm = clamp(throughputMbps / 1500, 0, 1);
  const lossPenalty = packetLoss * 0.5;
  return Number((0.6 * latencyNorm + 0.25 * (1 - throughputNorm) + 0.15 * lossPenalty).toFixed(3));
};

const weightToColor = (w: number) => {
  if (w <= 0.2) return "#059669";
  if (w <= 0.35) return "#0891b2";
  if (w <= 0.5) return "#2563eb";
  if (w <= 0.7) return "#d97706";
  return "#dc2626";
};

const hashStr = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

const deriveMetric = (edgeId: string, source: string, target: string): LinkMetric => {
  const seed = hashStr(`${edgeId}:${source}:${target}`);
  const latencyMs = 8 + (seed % 72);
  const throughputMbps = 480 + (seed % 1120);
  const packetLoss = seed % 20 === 0 ? 0.02 : 0;
  return { latencyMs, throughputMbps, packetLoss, weight: computeWeight(latencyMs, throughputMbps, packetLoss) };
};

/* Graph algorithms */
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

const dijkstraPath = (nodeIds: string[], edges: { source: string; target: string; weight: number }[], src: string, tgt: string): string[] => {
  const adj = new Map<string, { nodeId: string; cost: number }[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) {
    adj.get(e.source)?.push({ nodeId: e.target, cost: e.weight });
    adj.get(e.target)?.push({ nodeId: e.source, cost: e.weight });
  }
  const dist = new Map<string, number>(nodeIds.map(id => [id, Infinity]));
  const prev = new Map<string, string | null>();
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
    visited.add(cur);
    for (const next of adj.get(cur) ?? []) {
      if (visited.has(next.nodeId)) continue;
      const proposal = best + next.cost;
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
  for (const edge of ranked) {
    if (unionRoots(parent, rank, edge.source, edge.target)) {
      selected.add(edge.id);
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    }
  }
  for (const id of nodeIds) {
    while ((degree.get(id) ?? 0) < 2) {
      const alt = ranked.find(e => (e.source === id || e.target === id) && !selected.has(e.id));
      if (!alt) break;
      selected.add(alt.id);
      degree.set(alt.source, (degree.get(alt.source) ?? 0) + 1);
      degree.set(alt.target, (degree.get(alt.target) ?? 0) + 1);
    }
  }
  const selectedEdges = candidateEdges.filter(e => selected.has(e.id));
  for (const edge of ranked) {
    if (selected.has(edge.id)) continue;
    const routed = (() => {
      const adj = new Map<string, { nodeId: string; cost: number }[]>();
      for (const id of nodeIds) adj.set(id, []);
      for (const e of selectedEdges) {
        adj.get(e.source)?.push({ nodeId: e.target, cost: e.weight });
        adj.get(e.target)?.push({ nodeId: e.source, cost: e.weight });
      }
      const dist = new Map<string, number>(nodeIds.map(id => [id, Infinity]));
      dist.set(edge.source, 0);
      const vis = new Set<string>();
      while (vis.size < nodeIds.length) {
        let cur: string | null = null, best = Infinity;
        for (const id of nodeIds) { if (!vis.has(id) && (dist.get(id) ?? Infinity) < best) { best = dist.get(id)!; cur = id; } }
        if (!cur || best === Infinity) break;
        vis.add(cur);
        for (const next of adj.get(cur) ?? []) {
          if (!vis.has(next.nodeId)) {
            const proposal = best + next.cost;
            if (proposal < (dist.get(next.nodeId) ?? Infinity)) dist.set(next.nodeId, proposal);
          }
        }
      }
      return dist.get(edge.target) ?? Infinity;
    })();
    if (Number.isFinite(routed) && edge.weight * 1.2 < routed) {
      selected.add(edge.id);
      bypass.add(edge.id);
    }
  }
  return { selected, bypass };
};

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const RESOURCES = [
  "deployments/prod-us", "deployments/staging-eu", "events/deploy-abc",
  "metrics/cpu-timeseries", "logs/application-stream", "config/feature-flags",
  "releases/v2.1.0", "snapshots/db-backup",
];

const REGIONS: NodeRegion[] = ["us-e", "us-w", "eu", "ap"];
const QUERY_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#f43f5e", "#84cc16"];

const PHASE_LABELS: Record<QueryPhase, string> = {
  idle: "Idle", composing: "Composing", validating: "Validating",
  planning: "Planning Route", routing: "Routing", executing: "Executing",
  streaming: "Streaming", complete: "Complete", failed: "Failed", retrying: "Retrying",
};

const PHASE_ORDER: QueryPhase[] = ["composing", "validating", "planning", "routing", "executing", "streaming", "complete"];

const DEFAULT_FAILURE: FailureConfig = {
  nodeDropChance: 0.18, nodeJoinChance: 0.30, degradeChance: 0.08,
  partitionChance: 0.04, metricDriftRange: 18, ownershipTransferChance: 0.06,
};

const DEFAULT_SIM: SimConfig = {
  tickMs: 2000, hopDelayMs: 2500, processingDelayMs: 1200,
  autoQueryEnabled: false, autoQueryInterval: 3000, maxConcurrentQueries: 5,
};

/* ─── Predefined Scenarios ─── */
interface ScenarioConfig {
  name: string;
  description: string;
  failureConfig: FailureConfig;
  simConfig: SimConfig;
  autoQueries?: Array<{ delay: number; type: MeshQuery["type"]; label: string; description: string }>;
}

const SCENARIOS: Record<string, ScenarioConfig> = {
  "stable-mesh": {
    name: "🟢 Stable Mesh",
    description: "Perfect conditions: no failures, consistent latency. Shows normal query routing through healthy mesh.",
    failureConfig: { nodeDropChance: 0, nodeJoinChance: 0, degradeChance: 0, partitionChance: 0, metricDriftRange: 2, ownershipTransferChance: 0 },
    simConfig: { tickMs: 2000, hopDelayMs: 2500, processingDelayMs: 1200, autoQueryEnabled: false, autoQueryInterval: 3000, maxConcurrentQueries: 5 },
    autoQueries: [
      { delay: 1000, type: "read", label: "Simple read", description: "Query traverses optimal path through mesh. No failures = direct execution." },
    ],
  },
  "degradation": {
    name: "⚠️ Node Degradation",
    description: "Some nodes degrade (high load). Mesh re-routes around degraded nodes. Shows adaptive routing.",
    failureConfig: { nodeDropChance: 0, nodeJoinChance: 0.05, degradeChance: 0.15, partitionChance: 0, metricDriftRange: 25, ownershipTransferChance: 0 },
    simConfig: { tickMs: 2000, hopDelayMs: 2500, processingDelayMs: 1200, autoQueryEnabled: false, autoQueryInterval: 3000, maxConcurrentQueries: 5 },
    autoQueries: [
      { delay: 1000, type: "read", label: "Route around degraded", description: "Planner detects degraded nodes and chooses longer but faster paths." },
    ],
  },
  "node-failures": {
    name: "💥 Node Failures & Recovery",
    description: "Nodes drop offline and rejoin. Demonstrates failure detection, ownership transfer, and mesh re-healing.",
    failureConfig: { nodeDropChance: 0.22, nodeJoinChance: 0.35, degradeChance: 0.10, partitionChance: 0, metricDriftRange: 15, ownershipTransferChance: 0.08 },
    simConfig: { tickMs: 2000, hopDelayMs: 2500, processingDelayMs: 1200, autoQueryEnabled: false, autoQueryInterval: 4000, maxConcurrentQueries: 3 },
    autoQueries: [
      { delay: 2000, type: "read", label: "Query during failure", description: "Watch how queries adapt when nodes join/leave mid-execution." },
      { delay: 6000, type: "ownership-lookup", label: "Ownership lookup", description: "Finds which node owns a resource, even as ownership transfers." },
    ],
  },
  "network-partition": {
    name: "🔥 Network Partition (Split Brain)",
    description: "Network splits into 2 groups. Queries fail across partition. Shows partition detection and eventual healing.",
    failureConfig: { nodeDropChance: 0.05, nodeJoinChance: 0.02, degradeChance: 0.05, partitionChance: 0.12, metricDriftRange: 20, ownershipTransferChance: 0.03 },
    simConfig: { tickMs: 2000, hopDelayMs: 2500, processingDelayMs: 1200, autoQueryEnabled: false, autoQueryInterval: 3000, maxConcurrentQueries: 4 },
    autoQueries: [
      { delay: 1000, type: "read", label: "Cross-partition read", description: "Query attempts to cross partition. Fails because nodes can't communicate." },
      { delay: 8000, type: "write", label: "Write during partition", description: "Writes from both sides create divergence until healing occurs." },
    ],
  },
  "high-load": {
    name: "📈 High Load / Backpressure",
    description: "Many queries in flight simultaneously. Shows queueing, timeouts, and retries under load.",
    failureConfig: { nodeDropChance: 0.08, nodeJoinChance: 0.10, degradeChance: 0.12, partitionChance: 0.02, metricDriftRange: 30, ownershipTransferChance: 0.04 },
    simConfig: { tickMs: 1500, hopDelayMs: 2000, processingDelayMs: 900, autoQueryEnabled: true, autoQueryInterval: 800, maxConcurrentQueries: 15 },
  },
  "cascading-failures": {
    name: "🌊 Cascading Failures",
    description: "One failure triggers others. Shows how mesh topology adapts to minimize damage.",
    failureConfig: { nodeDropChance: 0.30, nodeJoinChance: 0.08, degradeChance: 0.20, partitionChance: 0.08, metricDriftRange: 40, ownershipTransferChance: 0.10 },
    simConfig: { tickMs: 1800, hopDelayMs: 2200, processingDelayMs: 1000, autoQueryEnabled: true, autoQueryInterval: 2000, maxConcurrentQueries: 8 },
  },
  "ownership-transfer": {
    name: "🔄 Ownership Transfer",
    description: "Watch resources being transferred between nodes as network conditions change.",
    failureConfig: { nodeDropChance: 0.10, nodeJoinChance: 0.15, degradeChance: 0.08, partitionChance: 0, metricDriftRange: 12, ownershipTransferChance: 0.20 },
    simConfig: { tickMs: 2000, hopDelayMs: 2500, processingDelayMs: 1200, autoQueryEnabled: false, autoQueryInterval: 3000, maxConcurrentQueries: 3 },
    autoQueries: [
      { delay: 1000, type: "ownership-lookup", label: "Lookup owner", description: "Finds which node owns 'deployments/prod-us'. Owner may change during query." },
    ],
  },
  "chaos": {
    name: "🎲 Chaos Engineering",
    description: "Everything breaks at once. Network chaos, node failures, degradation, partitions all active.",
    failureConfig: { nodeDropChance: 0.35, nodeJoinChance: 0.40, degradeChance: 0.25, partitionChance: 0.15, metricDriftRange: 50, ownershipTransferChance: 0.15 },
    simConfig: { tickMs: 1200, hopDelayMs: 1800, processingDelayMs: 800, autoQueryEnabled: true, autoQueryInterval: 500, maxConcurrentQueries: 12 },
  },
};

const createInitialNodes = (): MeshNode[] =>
  Array.from({ length: 12 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 12;
    return {
      id: `node-${i + 1}`, label: `N${i + 1}`, region: REGIONS[i % REGIONS.length],
      role: i === 0 ? "gateway" : i % 4 === 0 ? "owner" : "peer",
      status: "online" as NodeStatus,
      x: 340 + Math.cos(a) * 180, y: 220 + Math.sin(a) * 180,
      load: 0.1 + Math.random() * 0.5, cpuLoad: 0.1 + Math.random() * 0.4,
      memLoad: 0.2 + Math.random() * 0.3, connections: 0,
      ownedResources: i % 4 === 0 ? [RESOURCES[i % RESOURCES.length]!] : [],
      uptime: 0, totalQueries: 0, failedQueries: 0,
    };
  });

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function MeshQueryEngine() {
  const [scenario, setScenario] = useState<string>("stable-mesh");
  const scenarioConfig = SCENARIOS[scenario] || SCENARIOS["stable-mesh"];
  
  const [nodes, setNodes] = useState<MeshNode[]>(createInitialNodes);
  const [metrics, setMetrics] = useState<Record<string, LinkMetric>>({});
  const [simRunning, setSimRunning] = useState(true);
  const [tick, setTick] = useState(0);
  const [events, setEvents] = useState<MeshEvent[]>([]);
  const [queries, setQueries] = useState<MeshQuery[]>([]);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [failureConfig, setFailureConfig] = useState<FailureConfig>(scenarioConfig.failureConfig);
  const [simConfig, setSimConfig] = useState<SimConfig>(scenarioConfig.simConfig);
  const [showEventLog, setShowEventLog] = useState(true);
  const [showFailurePanel, setShowFailurePanel] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showScenarioPanel, setShowScenarioPanel] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [partitionActive, setPartitionActive] = useState(false);
  const [partitionGroupA, setPartitionGroupA] = useState<Set<string>>(new Set());
  const [partitionGroupB, setPartitionGroupB] = useState<Set<string>>(new Set());

  // Query form
  const [queryType, setQueryType] = useState<MeshQuery["type"]>("read");
  const [querySource, setQuerySource] = useState<string>("");
  const [queryTarget, setQueryTarget] = useState<string>("");
  const [queryResource, setQueryResource] = useState<string>("");
  const [queryFilter, setQueryFilter] = useState<string>("");

  const nextQueryId = useRef(0);
  const eventLogRef = useRef<HTMLDivElement>(null);
  const autoQueryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processedQueryIds = useRef<Set<string>>(new Set());

  /* ── Apply scenario config on selection ── */
  useEffect(() => {
    setFailureConfig(scenarioConfig.failureConfig);
    setSimConfig(scenarioConfig.simConfig);
    setEvents(prev => [{ id: uid(), tick: 0, type: "info", message: `📋 Scenario: ${scenarioConfig.name}`, severity: "info" }, ...prev].slice(0, 120));
    setQueries([]);
    setPackets([]);
    processedQueryIds.current.clear();
  }, [scenario]);

  /* ── Update node query counts when queries complete ── */
  useEffect(() => {
    const completedQueries = queries.filter(q => q.phase === "complete" && !processedQueryIds.current.has(q.id));
    if (completedQueries.length === 0) return;
    for (const q of completedQueries) {
      processedQueryIds.current.add(q.id);
    }
    setNodes(prev => prev.map(n => {
      let totalQueries = n.totalQueries;
      let failedQueries = n.failedQueries;
      for (const q of completedQueries) {
        if (q.hops.some(h => h.nodeId === n.id)) {
          totalQueries++;
          if (q.error) failedQueries++;
        }
      }
      return { ...n, totalQueries, failedQueries };
    }));
  }, [queries.length]);

  /* ── Add event ── */
  const addEvent = useCallback((type: MeshEvent["type"], message: string, severity: MeshEvent["severity"] = "info", nodeId?: string, queryId?: string) => {
    setEvents(prev => [{ id: uid(), tick, type, message, severity, nodeId, queryId }, ...prev].slice(0, 120));
  }, [tick]);

  /* ── Live simulation ── */
  useEffect(() => {
    if (!simRunning) return;
    const interval = setInterval(() => {
      setNodes(prev => {
        const next = prev.map(n => ({ ...n }));
        const online = next.filter(n => n.status === "online");
        const offline = next.filter(n => n.status === "offline");

        if (Math.random() < failureConfig.nodeDropChance && online.length > 5) {
          const drop = pickRandom(online);
          if (drop) {
            const idx = next.findIndex(n => n.id === drop.id);
            if (idx >= 0) { next[idx]!.status = "leaving"; next[idx]!.load = 0; addEvent("node-leave", `${drop.label} going offline`, "warn", drop.id); }
          }
        }
        if (Math.random() < failureConfig.nodeJoinChance && offline.length > 0) {
          const join = pickRandom(offline);
          if (join) {
            const idx = next.findIndex(n => n.id === join.id);
            if (idx >= 0) { next[idx]!.status = "joining"; addEvent("node-join", `${join.label} joining mesh`, "info", join.id); }
          }
        }
        for (const n of next) {
          if (n.status === "online" && Math.random() < failureConfig.degradeChance) {
            n.status = "degraded"; n.load = clamp(n.load + 0.2, 0, 1);
            addEvent("node-degrade", `${n.label} degraded (load: ${(n.load * 100).toFixed(0)}%)`, "warn", n.id);
          } else if (n.status === "degraded" && Math.random() < 0.25) {
            n.status = "online"; n.load = clamp(n.load - 0.15, 0.1, 1);
          } else if (n.status === "leaving" && Math.random() < 0.5) {
            n.status = "offline"; n.uptime = 0;
          } else if (n.status === "joining" && Math.random() < 0.6) {
            n.status = "online"; n.load = 0.1 + Math.random() * 0.3;
          }
          if (n.status === "online" || n.status === "degraded") {
            n.load = clamp(n.load + (Math.random() * 0.1 - 0.05), 0.05, 0.95);
            n.cpuLoad = clamp(n.cpuLoad + (Math.random() * 0.08 - 0.04), 0.05, 0.95);
            n.memLoad = clamp(n.memLoad + (Math.random() * 0.04 - 0.02), 0.1, 0.9);
            n.uptime++;
          }
        }
        if (Math.random() < failureConfig.ownershipTransferChance) {
          const owners = next.filter(n => n.status === "online" && n.ownedResources.length > 0);
          const targets = next.filter(n => n.status === "online" && n.ownedResources.length === 0);
          if (owners.length > 0 && targets.length > 0) {
            const from = pickRandom(owners); const to = pickRandom(targets);
            if (from && to) {
              const res = from.ownedResources[0]!;
              const fromIdx = next.findIndex(n => n.id === from.id);
              const toIdx = next.findIndex(n => n.id === to.id);
              if (fromIdx >= 0 && toIdx >= 0) {
                next[fromIdx]!.ownedResources = from.ownedResources.filter(r => r !== res);
                next[toIdx]!.ownedResources = [...next[toIdx]!.ownedResources, res];
                addEvent("ownership-transfer", `${from.label} → ${to.label}: ${res}`, "info");
              }
            }
          }
        }
        if (Math.random() < failureConfig.partitionChance && !partitionActive) {
          const shuffled = [...next.filter(n => n.status === "online")].sort(() => Math.random() - 0.5);
          if (shuffled.length >= 4) {
            const mid = Math.floor(shuffled.length / 2);
            setPartitionGroupA(new Set(shuffled.slice(0, mid).map(n => n.id)));
            setPartitionGroupB(new Set(shuffled.slice(mid).map(n => n.id)));
            setPartitionActive(true);
            addEvent("partition", `Network partition: ${mid} ↔ ${shuffled.length - mid} nodes`, "error");
          }
        } else if (partitionActive && Math.random() < 0.15) {
          setPartitionActive(false); setPartitionGroupA(new Set()); setPartitionGroupB(new Set());
          addEvent("partition-heal", "Network partition healed", "success");
        }
        return next;
      });

      setMetrics(prev => {
        const next: Record<string, LinkMetric> = {};
        for (let i = 0; i < 12; i++) {
          for (let j = i + 1; j < 12; j++) {
            const id = `mesh-node-${i + 1}__node-${j + 1}`;
            const base = prev[id] ?? deriveMetric(id, `node-${i + 1}`, `node-${j + 1}`);
            const drift = failureConfig.metricDriftRange;
            const lat = clamp(base.latencyMs + (Math.random() * drift * 2 - drift), 4, 280);
            const tp = clamp(base.throughputMbps + (Math.random() * drift * 10 - drift * 5), 100, 2000);
            const loss = clamp(base.packetLoss + (Math.random() * 0.02 - 0.01), 0, 0.15);
            next[id] = { latencyMs: Math.round(lat), throughputMbps: Math.round(tp), packetLoss: Number(loss.toFixed(3)), weight: computeWeight(lat, tp, loss) };
          }
        }
        return next;
      });

      setTick(t => t + 1);
    }, simConfig.tickMs);
    return () => clearInterval(interval);
  }, [simRunning, failureConfig, partitionActive, addEvent, simConfig.tickMs]);

  /* ── Compute edges ── */
  const { edges, onlineCount, onlineIds, connCounts } = useMemo(() => {
    const onlineNodes = nodes.filter(n => n.status === "online" || n.status === "degraded" || n.status === "joining");
    const oIds = onlineNodes.map(n => n.id);
    const onlineSet = new Set(oIds);
    const candidates: { id: string; source: string; target: string; weight: number }[] = [];
    for (let i = 0; i < 12; i++) {
      for (let j = i + 1; j < 12; j++) {
        const si = `node-${i + 1}`, sj = `node-${j + 1}`;
        if (!onlineSet.has(si) || !onlineSet.has(sj)) continue;
        if (partitionActive && partitionGroupA.size > 0 && partitionGroupB.size > 0) {
          const aInA = partitionGroupA.has(si), bInA = partitionGroupA.has(sj);
          const aInB = partitionGroupB.has(si), bInB = partitionGroupB.has(sj);
          if ((aInA && bInB) || (aInB && bInA)) continue;
        }
        const id = `mesh-${si}__${sj}`;
        const m = metrics[id] ?? deriveMetric(id, si, sj);
        candidates.push({ id, source: si, target: sj, weight: m.weight });
      }
    }
    const { selected, bypass } = selectRuleBasedEdges(oIds, candidates);
    const result: MeshEdge[] = candidates.filter(c => selected.has(c.id)).map(c => {
      const m = metrics[c.id] ?? deriveMetric(c.id, c.source, c.target);
      const status: MeshEdge["status"] = m.packetLoss > 0.05 ? "degraded" : m.weight > 0.7 ? "degraded" : "active";
      return { id: c.id, source: c.source, target: c.target, selected: true, bypass: bypass.has(c.id), metric: m, status };
    });
    // Compute connection counts (don't update state here)
    const counts = new Map<string, number>();
    for (const e of result) {
      counts.set(e.source, (counts.get(e.source) ?? 0) + 1);
      counts.set(e.target, (counts.get(e.target) ?? 0) + 1);
    }
    return { edges: result, onlineCount: onlineNodes.length, onlineIds: oIds, connCounts: counts };
  }, [metrics, tick, partitionActive, partitionGroupA, partitionGroupB]);

  /* ── Update node connections from computed edges ── */
  useEffect(() => {
    if (connCounts.size === 0) return;
    setNodes(prev => prev.map(n => ({ ...n, connections: connCounts.get(n.id) ?? 0 })));
  }, [connCounts]);

  /* ── Query state machine with slow hop-by-hop animation ── */
  useEffect(() => {
    if (queries.length === 0) return;
    const hopDelay = simConfig.hopDelayMs;
    const processingDelay = simConfig.processingDelayMs;

    const interval = setInterval(() => {
      setQueries(prev => prev.map(q => {
        if (q.phase === "complete" || q.phase === "failed") return q;

        // Check if current hop node went offline
        if (q.phase === "routing" || q.phase === "executing") {
          const currentHop = q.hops[q.currentHopIndex];
          if (currentHop) {
            const node = nodes.find(n => n.id === currentHop.nodeId);
            if (node && (node.status === "offline" || node.status === "leaving")) {
              addEvent("query-fail", `Query ${q.id}: node ${node.label} went offline`, "error", node.id, q.id);
              if (q.retryCount < q.maxRetries) {
                return { ...q, phase: "retrying" as QueryPhase, retryCount: q.retryCount + 1 };
              }
              return { ...q, phase: "failed" as QueryPhase, error: `Node ${node.label} offline`, completedAt: tick };
            }
          }
        }

        // Phase transitions
        if (q.phase === "composing") {
          return { ...q, phase: "validating" as QueryPhase };
        }
        if (q.phase === "validating") {
          const onlineSet = new Set(onlineIds);
          if (!onlineSet.has(q.source) || !onlineSet.has(q.target)) {
            return { ...q, phase: "failed" as QueryPhase, error: "Source or target offline", completedAt: tick };
          }
          const path = dijkstraPath(onlineIds, edges.map(e => ({ source: e.source, target: e.target, weight: e.metric.weight })), q.source, q.target);
          if (path.length === 0) {
            return { ...q, phase: "failed" as QueryPhase, error: "No route available", completedAt: tick };
          }
          const hops: QueryHop[] = path.map((nodeId, i) => ({
            nodeId,
            status: i === 0 ? "entering" as HopStatus : "pending" as HopStatus,
            latencyMs: Math.round(8 + Math.random() * 60),
            processingMs: Math.round(processingDelay * (0.5 + Math.random())),
            event: i === 0 ? "entry" : i === path.length - 1 ? "target reached" : "relay",
          }));
          addEvent("query-start", `Query ${q.id}: route planned (${path.length} hops)`, "info", undefined, q.id);
          return { ...q, phase: "routing" as QueryPhase, hops, currentHopIndex: 0 };
        }

        // Hop-by-hop animation
        if (q.phase === "routing" || q.phase === "executing") {
          const hop = q.hops[q.currentHopIndex];
          if (!hop) return { ...q, phase: "executing" as QueryPhase };

          if (hop.status === "entering") {
            // Create packet animation
            setPackets(prev => [...prev, {
              id: `${q.id}-${hop.nodeId}-enter`,
              queryId: q.id, fromNode: q.currentHopIndex > 0 ? q.hops[q.currentHopIndex - 1]!.nodeId : q.source,
              toNode: hop.nodeId, progress: 0, color: q.color, phase: "entering",
            }]);
            return { ...q, hops: q.hops.map((h, i) => i === q.currentHopIndex ? { ...h, status: "processing" as HopStatus } : h) };
          }
          if (hop.status === "processing") {
            // After processing, move to exiting
            return { ...q, hops: q.hops.map((h, i) => i === q.currentHopIndex ? { ...h, status: "exiting" as HopStatus } : h) };
          }
          if (hop.status === "exiting") {
            // Move to next hop
            const nextIdx = q.currentHopIndex + 1;
            if (nextIdx >= q.hops.length) {
              // All hops done
              if (q.phase === "routing") {
                return { ...q, phase: "executing" as QueryPhase, hops: q.hops.map((h, i) => i === q.currentHopIndex ? { ...h, status: "done" as HopStatus } : h) };
              }
              // executing done → streaming
              addEvent("query-complete", `Query ${q.id}: complete`, "success", undefined, q.id);
              return {
                ...q, phase: "streaming" as QueryPhase,
                hops: q.hops.map((h, i) => i === q.currentHopIndex ? { ...h, status: "done" as HopStatus } : h),
              };
            }
            // Create packet for next hop
            setPackets(prev => [...prev, {
              id: `${q.id}-${q.hops[nextIdx]!.nodeId}-hop`,
              queryId: q.id, fromNode: hop.nodeId, toNode: q.hops[nextIdx]!.nodeId,
              progress: 0, color: q.color, phase: "entering",
            }]);
            return {
              ...q,
              currentHopIndex: nextIdx,
              hops: q.hops.map((h, i) => i === q.currentHopIndex ? { ...h, status: "done" as HopStatus } : i === nextIdx ? { ...h, status: "entering" as HopStatus } : h),
            };
          }
        }

        if (q.phase === "streaming") {
          addEvent("query-complete", `Query ${q.id}: streaming done`, "success", undefined, q.id);
          return {
            ...q, phase: "complete" as QueryPhase, completedAt: tick,
            result: {
              rows: Math.round(10 + Math.random() * 200),
              latencyMs: q.hops.reduce((s, h) => s + h.latencyMs, 0),
              fromCache: Math.random() < 0.3,
              bytesTransferred: Math.round(1024 + Math.random() * 51200),
            },
          };
        }

        if (q.phase === "retrying") {
          const onlineSet = new Set(onlineIds);
          if (!onlineSet.has(q.source) || !onlineSet.has(q.target)) {
            return { ...q, phase: "failed" as QueryPhase, error: "Source or target still offline", completedAt: tick };
          }
          const path = dijkstraPath(onlineIds, edges.map(e => ({ source: e.source, target: e.target, weight: e.metric.weight })), q.source, q.target);
          if (path.length === 0) {
            return { ...q, phase: "failed" as QueryPhase, error: "No route on retry", completedAt: tick };
          }
          addEvent("query-retry", `Query ${q.id}: retrying (${path.length} hops)`, "warn", undefined, q.id);
          const hops: QueryHop[] = path.map((nodeId, i) => ({
            nodeId, status: i === 0 ? "entering" as HopStatus : "pending" as HopStatus,
            latencyMs: Math.round(8 + Math.random() * 60),
            processingMs: Math.round(processingDelay * (0.5 + Math.random())),
            event: i === 0 ? "retry entry" : i === path.length - 1 ? "target reached" : "relay",
          }));
          return { ...q, phase: "routing" as QueryPhase, hops, currentHopIndex: 0 };
        }

        return q;
      }));
    }, hopDelay);
    return () => clearInterval(interval);
  }, [queries, nodes, edges, onlineIds, tick, addEvent, simConfig.hopDelayMs, simConfig.processingDelayMs]);

  /* ── Animate packets ── */
  useEffect(() => {
    if (packets.length === 0) return;
    const interval = setInterval(() => {
      setPackets(prev => {
        const next = prev.map(p => ({ ...p, progress: Math.min(1, p.progress + 0.15) }));
        return next.filter(p => p.progress < 1);
      });
    }, 50);
    return () => clearInterval(interval);
  }, [packets.length]);

  /* ── Auto-query ── */
  useEffect(() => {
    if (autoQueryTimerRef.current) clearInterval(autoQueryTimerRef.current);
    if (!simConfig.autoQueryEnabled) return;
    autoQueryTimerRef.current = setInterval(() => {
      const online = nodes.filter(n => n.status === "online" || n.status === "degraded");
      if (online.length < 2) return;
      if (queries.filter(q => q.phase !== "complete" && q.phase !== "failed").length >= simConfig.maxConcurrentQueries) return;
      const src = pickRandom(online);
      const tgt = pickRandom(online.filter(n => n.id !== src.id));
      if (!src || !tgt || src.id === tgt.id) return;
      const types: MeshQuery["type"][] = ["read", "write", "subscribe", "ownership-lookup", "join"];
      const q: MeshQuery = {
        id: `Q${++nextQueryId.current}`, type: pickRandom(types),
        source: src.id, target: tgt.id,
        resource: Math.random() < 0.5 ? pickRandom(RESOURCES) : undefined,
        phase: "composing", hops: [], currentHopIndex: 0,
        startedAt: tick, completedAt: null, retryCount: 0,
        maxRetries: 2, color: QUERY_COLORS[(nextQueryId.current - 1) % QUERY_COLORS.length]!,
      };
      setQueries(prev => [q, ...prev].slice(0, 12));
      addEvent("query-start", `Auto: ${q.id} ${q.type} ${src.label}→${tgt.label}`, "info", undefined, q.id);
    }, simConfig.autoQueryInterval);
    return () => { if (autoQueryTimerRef.current) clearInterval(autoQueryTimerRef.current); };
  }, [simConfig.autoQueryEnabled, simConfig.autoQueryInterval, simConfig.maxConcurrentQueries, nodes, tick, addEvent, queries.length]);

  /* ── Submit query ── */
  const handleSubmitQuery = useCallback(() => {
    if (!querySource || !queryTarget || querySource === queryTarget) return;
    const q: MeshQuery = {
      id: `Q${++nextQueryId.current}`, type: queryType, source: querySource, target: queryTarget,
      resource: queryResource || undefined, filter: queryFilter || undefined,
      phase: "composing", hops: [], currentHopIndex: 0,
      startedAt: tick, completedAt: null, retryCount: 0,
      maxRetries: queryType === "read" ? 2 : queryType === "subscribe" ? 3 : 1,
      color: QUERY_COLORS[(nextQueryId.current - 1) % QUERY_COLORS.length]!,
    };
    setQueries(prev => [q, ...prev].slice(0, 12));
    addEvent("query-start", `Query ${q.id}: ${q.type} ${nodes.find(n => n.id === q.source)?.label}→${nodes.find(n => n.id === q.target)?.label}`, "info", undefined, q.id);
  }, [querySource, queryTarget, queryType, queryResource, queryFilter, tick, nodes, addEvent]);

  const clearCompleted = useCallback(() => {
    setQueries(prev => prev.filter(q => q.phase !== "complete" && q.phase !== "failed"));
  }, []);

  const injectNodeFailure = useCallback((nodeId: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, status: "leaving" as NodeStatus, load: 0 } : n));
    addEvent("node-leave", `Manual: ${nodes.find(n => n.id === nodeId)?.label} forced offline`, "error", nodeId);
  }, [nodes, addEvent]);

  /* ── Derived ── */
  const onlineNodes = nodes.filter(n => n.status === "online" || n.status === "degraded" || n.status === "joining");
  const activeQueries = queries.filter(q => q.phase !== "complete" && q.phase !== "failed");
  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const phaseColor = (phase: QueryPhase) => {
    switch (phase) {
      case "composing": case "validating": return "text-blue-500";
      case "planning": return "text-cyan-500";
      case "routing": return "text-amber-500";
      case "executing": return "text-indigo-500";
      case "streaming": return "text-emerald-500";
      case "complete": return "text-green-600";
      case "failed": return "text-red-500";
      case "retrying": return "text-orange-500";
      default: return "text-muted-foreground";
    }
  };

  const phaseBg = (phase: QueryPhase) => {
    switch (phase) {
      case "composing": case "validating": return "bg-blue-500/10 border-blue-500/20";
      case "planning": return "bg-cyan-500/10 border-cyan-500/20";
      case "routing": return "bg-amber-500/10 border-amber-500/20";
      case "executing": return "bg-indigo-500/10 border-indigo-500/20";
      case "streaming": return "bg-emerald-500/10 border-emerald-500/20";
      case "complete": return "bg-green-500/10 border-green-500/20";
      case "failed": return "bg-red-500/10 border-red-500/20";
      case "retrying": return "bg-orange-500/10 border-orange-500/20";
      default: return "bg-muted/50 border-border";
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div className="my-8 overflow-hidden rounded-xl border border-border bg-surface/30 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-surface/50 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-indigo-500" />
          <div>
            <h3 className="text-sm font-semibold">Mesh Query Engine</h3>
            <p className="text-[10px] text-muted-foreground">State machine: compose → validate → plan → route → execute → stream</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground font-mono">t={tick}</span>
          <button onClick={() => setShowScenarioPanel(!showScenarioPanel)} className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition ${showScenarioPanel ? "bg-purple-500/10 text-purple-600" : "hover:bg-muted"}`}>
            <Shuffle className="w-3.5 h-3.5" /> Scenarios
          </button>
          <button onClick={() => setSimRunning(!simRunning)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${simRunning ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
            {simRunning ? <><Activity className="w-3.5 h-3.5" /> Live</> : <><Activity className="w-3.5 h-3.5" /> Paused</>}
          </button>
          <button onClick={() => { setNodes(createInitialNodes()); setMetrics({}); setQueries([]); setEvents([]); setPackets([]); setPartitionActive(false); }} className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs hover:bg-muted transition">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button onClick={() => setShowConfigPanel(!showConfigPanel)} className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition ${showConfigPanel ? "bg-indigo-500/10 text-indigo-600" : "hover:bg-muted"}`}>
            <Settings className="w-3.5 h-3.5" /> Config
          </button>
          <button onClick={() => setShowFailurePanel(!showFailurePanel)} className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition ${showFailurePanel ? "bg-red-500/10 text-red-600" : "hover:bg-muted"}`}>
            <Bug className="w-3.5 h-3.5" /> Chaos
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row">
        {/* ── Graph ── */}
        <div className="flex-1 min-h-120 relative bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]" suppressHydrationWarning>
          <svg viewBox="0 0 680 440" className="absolute inset-0 w-full h-full" suppressHydrationWarning>
            <defs>
              <marker id="mq-arrow" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                <polygon points="0 0, 6 2, 0 4" fill="oklch(0.5 0.04 280)" />
              </marker>
              <marker id="mq-arrow-active" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                <polygon points="0 0, 6 2, 0 4" fill="var(--indigo)" />
              </marker>
              <marker id="mq-arrow-degraded" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                <polygon points="0 0, 6 2, 0 4" fill="#d97706" />
              </marker>
            </defs>

            {/* Edges */}
            {edges.map(e => {
              const src = nodes.find(n => n.id === e.source);
              const tgt = nodes.find(n => n.id === e.target);
              if (!src || !tgt) return null;
              const isQueryEdge = activeQueries.some(q =>
                q.hops.length > 1 && q.hops.some((h, i) =>
                  i < q.hops.length - 1 &&
                  ((h.nodeId === e.source && q.hops[i + 1]!.nodeId === e.target) ||
                   (h.nodeId === e.target && q.hops[i + 1]!.nodeId === e.source))
                )
              );
              const color = isQueryEdge ? "var(--indigo)" : e.status === "degraded" ? "#d97706" : weightToColor(e.metric.weight);
              const width = isQueryEdge ? 2.5 : (1.2 + (1 - e.metric.weight) * 2);
              return (
                <g key={e.id}>
                  <motion.line
                    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={color} strokeWidth={width}
                    strokeDasharray={e.bypass ? "6 4" : e.status === "degraded" ? "3 3" : undefined}
                    markerEnd={isQueryEdge ? "url(#mq-arrow-active)" : e.status === "degraded" ? "url(#mq-arrow-degraded)" : "url(#mq-arrow)"}
                    opacity={isQueryEdge ? 1 : 0.5}
                    initial={false} animate={{ opacity: isQueryEdge ? 1 : 0.5 }} transition={{ duration: 0.3 }}
                  />
                  {isQueryEdge && (
                    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <rect x={(src.x + tgt.x) / 2 - 28} y={(src.y + tgt.y) / 2 - 7} width="56" height="14" rx="3" fill="oklch(var(--surface))" stroke="var(--indigo)" strokeWidth="0.5" />
                      <text x={(src.x + tgt.x) / 2} y={(src.y + tgt.y) / 2 + 3} textAnchor="middle" fontSize="6" fill="var(--indigo)" className="font-mono">{e.metric.latencyMs}ms</text>
                    </motion.g>
                  )}
                </g>
              );
            })}

            {/* Animated packets */}
            {packets.map(p => {
              const srcNode = nodes.find(n => n.id === p.fromNode);
              const tgtNode = nodes.find(n => n.id === p.toNode);
              if (!srcNode || !tgtNode) return null;
              const px = srcNode.x + (tgtNode.x - srcNode.x) * p.progress;
              const py = srcNode.y + (tgtNode.y - srcNode.y) * p.progress;
              return (
                <motion.circle
                  key={p.id}
                  cx={px} cy={py} r="4"
                  fill={p.color}
                  initial={{ opacity: 0, r: 2 }}
                  animate={{ opacity: [0.4, 1, 0.4], r: [3, 5, 3] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              );
            })}

            {/* Query hop indicators (pulsing rings on active nodes) */}
            {activeQueries.map(q => {
              if (q.hops.length === 0) return null;
              const hop = q.hops[q.currentHopIndex];
              if (!hop || hop.status === "done" || hop.status === "pending") return null;
              const node = nodes.find(n => n.id === hop.nodeId);
              if (!node) return null;
              return (
                <motion.circle
                  key={`hop-${q.id}-${hop.nodeId}`}
                  cx={node.x} cy={node.y} r={20}
                  fill="none" stroke={q.color} strokeWidth={2}
                  animate={{ r: [20, 28, 20], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map(n => {
              const isOnline = n.status === "online" || n.status === "degraded" || n.status === "joining";
              const isSource = queries.some(q => q.source === n.id && q.phase !== "complete" && q.phase !== "failed");
              const isTarget = queries.some(q => q.target === n.id && q.phase !== "complete" && q.phase !== "failed");
              const isOnPath = queries.some(q => q.hops.some(h => h.nodeId === n.id) && q.phase !== "complete" && q.phase !== "failed");
              const isOwner = n.ownedResources.length > 0;
              const isSelected = selectedNodeId === n.id;

              const strokeColor = !isOnline ? "oklch(0.7 0.02 280)"
                : n.status === "degraded" ? "#d97706"
                : n.status === "joining" ? "#0891b2"
                : isSource ? "#059669"
                : isTarget ? "#dc2626"
                : isOnPath ? "var(--indigo)"
                : "oklch(0.6 0.15 250)";

              const fillColor = !isOnline ? "oklch(0.92 0.01 280)"
                : n.status === "degraded" ? "oklch(0.95 0.06 80)"
                : n.status === "joining" ? "oklch(0.95 0.06 200)"
                : isOnPath ? "oklch(0.95 0.08 280)"
                : "oklch(var(--surface))";

              return (
                <g key={n.id} opacity={isOnline ? 1 : 0.25} className="cursor-pointer" onClick={() => setSelectedNodeId(isSelected ? null : n.id)}>
                  {(isOnline && (isSource || isTarget || isOnPath || isOwner)) && (
                    <motion.circle
                      cx={n.x} cy={n.y} r={22}
                      fill={isSource ? "#059669" : isTarget ? "#dc2626" : isOwner ? "#7c3aed" : "var(--indigo)"}
                      fillOpacity={0.1}
                      animate={{ r: [22, 30, 22], opacity: [0.1, 0, 0.1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                  {isSelected && (
                    <rect x={n.x - 30} y={n.y - 24} width="60" height="48" rx="10" fill="none" stroke="var(--indigo)" strokeWidth={2} strokeDasharray="4 2" />
                  )}
                  <rect
                    x={n.x - 26} y={n.y - 20} width="52" height="40" rx="8"
                    fill={fillColor} stroke={strokeColor}
                    strokeWidth={isSource || isTarget || isOnPath || isSelected ? 2 : 1}
                  />
                  <text x={n.x} y={n.y - 4} textAnchor="middle" fontSize="9" fontWeight="600" fill="currentColor">{n.label}</text>
                  <text x={n.x} y={n.y + 8} textAnchor="middle" fontSize="6" fill="oklch(var(--muted-foreground))">
                    {n.region}{n.status === "degraded" ? " ⚠" : n.status === "joining" ? " →" : n.status === "leaving" ? " ↓" : n.status === "offline" ? " ✗" : ""}
                  </text>
                  {isOnline && (
                    <>
                      <rect x={n.x - 18} y={n.y + 13} width="36" height="3" rx="1.5" fill="oklch(0.9 0.02 280)" />
                      <rect x={n.x - 18} y={n.y + 13} width={Math.max(1, 36 * n.load)} height="3" rx="1.5" fill={n.load > 0.7 ? "#dc2626" : n.load > 0.4 ? "#d97706" : "#059669"} />
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-2 text-[9px] bg-surface/80 backdrop-blur-sm rounded-md px-2 py-1 border border-border/40">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> source</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> target</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> owner</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> degraded</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500" /> joining</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> on path</span>
          </div>
        </div>

        {/* ── Side panel ── */}
        <div className="w-full xl:w-96 border-t xl:border-t-0 xl:border-l border-border/60 bg-surface/50 flex flex-col overflow-y-auto max-h-175">
          <div className="p-4 space-y-3 flex-1">

            {/* Stats */}
            <div className="grid grid-cols-4 gap-1.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">{onlineCount}</div>
                <div className="text-[8px] text-muted-foreground">Online</div>
              </div>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-center">
                <div className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400">{edges.length}</div>
                <div className="text-[8px] text-muted-foreground">Links</div>
              </div>
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                <div className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">{activeQueries.length}</div>
                <div className="text-[8px] text-muted-foreground">Active</div>
              </div>
              <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
                <div className="text-sm font-bold font-mono text-purple-600 dark:text-purple-400">{packets.length}</div>
                <div className="text-[8px] text-muted-foreground">Packets</div>
              </div>
            </div>

            {/* ── Scenarios Panel ── */}
            <AnimatePresence>
              {showScenarioPanel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] uppercase tracking-wider text-foreground font-semibold flex items-center gap-1.5">
                        <Shuffle className="w-3.5 h-3.5 text-purple-500" />
                        Predefined Scenarios
                      </div>
                    </div>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {Object.entries(SCENARIOS).map(([key, s]) => (
                        <button
                          key={key}
                          onClick={() => setScenario(key)}
                          className={`w-full text-left p-2 rounded-md transition ${
                            scenario === key
                              ? "bg-purple-500/20 border border-purple-500/40 text-purple-600 dark:text-purple-400"
                              : "bg-muted/30 border border-transparent hover:bg-muted/50"
                          }`}
                        >
                          <div className="text-[11px] font-semibold">{s.name}</div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">{s.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Partition warning ── */}
            {partitionActive && (
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <div className="text-[11px] text-red-600 dark:text-red-400">
                  Network partition: {partitionGroupA.size} ↔ {partitionGroupB.size} nodes split
                </div>
              </div>
            )}

            {/* ── Node Detail Panel ── */}
            <AnimatePresence>
              {selectedNode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 rounded-lg border border-indigo-500/30 bg-indigo-500/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-semibold">{selectedNode.label}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                          selectedNode.status === "online" ? "bg-emerald-500/10 text-emerald-600" :
                          selectedNode.status === "degraded" ? "bg-amber-500/10 text-amber-600" :
                          selectedNode.status === "joining" ? "bg-cyan-500/10 text-cyan-600" :
                          selectedNode.status === "leaving" ? "bg-orange-500/10 text-orange-600" :
                          "bg-red-500/10 text-red-600"
                        }`}>{selectedNode.status}</span>
                      </div>
                      <button onClick={() => setSelectedNodeId(null)} className="p-1 rounded hover:bg-muted transition">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      <div className="flex items-center gap-1.5"><Globe className="w-3 h-3 text-muted-foreground" /> Region: <span className="font-mono">{selectedNode.region}</span></div>
                      <div className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-muted-foreground" /> Role: <span className="font-mono">{selectedNode.role}</span></div>
                      <div className="flex items-center gap-1.5"><Cpu className="w-3 h-3 text-muted-foreground" /> CPU: <span className="font-mono">{(selectedNode.cpuLoad * 100).toFixed(0)}%</span></div>
                      <div className="flex items-center gap-1.5"><HardDrive className="w-3 h-3 text-muted-foreground" /> Mem: <span className="font-mono">{(selectedNode.memLoad * 100).toFixed(0)}%</span></div>
                      <div className="flex items-center gap-1.5"><Gauge className="w-3 h-3 text-muted-foreground" /> Load: <span className="font-mono">{(selectedNode.load * 100).toFixed(0)}%</span></div>
                      <div className="flex items-center gap-1.5"><Network className="w-3 h-3 text-muted-foreground" /> Links: <span className="font-mono">{selectedNode.connections}</span></div>
                      <div className="flex items-center gap-1.5"><Timer className="w-3 h-3 text-muted-foreground" /> Uptime: <span className="font-mono">{selectedNode.uptime}t</span></div>
                      <div className="flex items-center gap-1.5"><ArrowLeftRight className="w-3 h-3 text-muted-foreground" /> Queries: <span className="font-mono">{selectedNode.totalQueries}</span></div>
                    </div>
                    {selectedNode.ownedResources.length > 0 && (
                      <div className="mt-2">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Owned Resources</div>
                        <div className="flex flex-wrap gap-1">
                          {selectedNode.ownedResources.map(r => (
                            <span key={r} className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[9px] font-mono">{r}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Connected edges */}
                    <div className="mt-2">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Connected Edges</div>
                      <div className="space-y-0.5 max-h-24 overflow-y-auto">
                        {edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).map(e => {
                          const peer = e.source === selectedNode.id ? e.target : e.source;
                          const peerNode = nodes.find(n => n.id === peer);
                          return (
                            <div key={e.id} className="flex items-center justify-between text-[9px] font-mono">
                              <span>→ {peerNode?.label ?? peer}</span>
                              <span className="text-muted-foreground">{e.metric.latencyMs}ms · {e.metric.throughputMbps}Mbps · w:{e.metric.weight.toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Active queries through this node */}
                    {queries.filter(q => q.hops.some(h => h.nodeId === selectedNode.id) && q.phase !== "complete" && q.phase !== "failed").length > 0 && (
                      <div className="mt-2">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Active Queries</div>
                        <div className="flex flex-wrap gap-1">
                          {queries.filter(q => q.hops.some(h => h.nodeId === selectedNode.id) && q.phase !== "complete" && q.phase !== "failed").map(q => (
                            <span key={q.id} className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: q.color + "20", color: q.color }}>{q.id} {q.phase}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Kill button */}
                    {selectedNode.status === "online" && (
                      <button onClick={() => { injectNodeFailure(selectedNode.id); setSelectedNodeId(null); }} className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] hover:bg-red-500/20 transition">
                        <XCircle className="w-3 h-3" /> Kill Node
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Query Builder ── */}
            <div className="p-3 rounded-lg border border-border/60 bg-surface/60">
              <div className="text-[10px] uppercase tracking-wider text-foreground font-semibold mb-2 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-indigo-500" />
                Query Builder
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Type</label>
                    <select value={queryType} onChange={e => setQueryType(e.target.value as MeshQuery["type"])} className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5">
                      <option value="read">Read</option>
                      <option value="write">Write</option>
                      <option value="subscribe">Subscribe</option>
                      <option value="ownership-lookup">Owner Lookup</option>
                      <option value="join">Join Query</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Resource</label>
                    <select value={queryResource} onChange={e => setQueryResource(e.target.value)} className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5">
                      <option value="">Any resource</option>
                      {RESOURCES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Source node</label>
                    <select value={querySource} onChange={e => setQuerySource(e.target.value)} className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5">
                      <option value="">Select source…</option>
                      {nodes.filter(n => n.status === "online" || n.status === "degraded").map(n => (
                        <option key={n.id} value={n.id}>{n.label} ({n.region})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Target node</label>
                    <select value={queryTarget} onChange={e => setQueryTarget(e.target.value)} className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5">
                      <option value="">Select target…</option>
                      {nodes.filter(n => (n.status === "online" || n.status === "degraded") && n.id !== querySource).map(n => (
                        <option key={n.id} value={n.id}>{n.label} ({n.region})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Filter (optional)</label>
                  <input type="text" value={queryFilter} onChange={e => setQueryFilter(e.target.value)} placeholder="e.g. status=running, env=prod" className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSubmitQuery} disabled={!querySource || !queryTarget || querySource === queryTarget} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition disabled:opacity-50">
                    <Send className="w-3 h-3" /> Send Query
                  </button>
                  <button onClick={clearCompleted} className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-border/60 text-xs hover:bg-muted transition">
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                </div>
              </div>
            </div>

            {/* ── Phase Pipeline ── */}
            {activeQueries.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-foreground font-semibold">Active Queries</div>
                <AnimatePresence>
                  {queries.slice(0, 6).map(q => (
                    <motion.div key={q.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`p-2 rounded-lg border text-[11px] ${phaseBg(q.phase)}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: q.color }} />
                          <span className="font-semibold">{q.id}</span>
                          <span className={`font-mono ${phaseColor(q.phase)}`}>{PHASE_LABELS[q.phase]}</span>
                        </div>
                        <span className="text-muted-foreground font-mono text-[9px]">{q.type}</span>
                      </div>
                      {/* Phase pipeline visualization */}
                      <div className="flex items-center gap-0.5 mb-1.5">
                        {PHASE_ORDER.map((phase, i) => {
                          const currentIdx = PHASE_ORDER.indexOf(q.phase);
                          const isDone = i < currentIdx;
                          const isCurrent = phase === q.phase;
                          return (
                            <div key={phase} className="flex items-center gap-0.5">
                              <div className={`h-1.5 flex-1 rounded-full transition-colors ${isDone ? "" : isCurrent ? "" : "bg-muted"}`} style={isDone || isCurrent ? { background: q.color } : undefined} />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        {nodes.find(n => n.id === q.source)?.label ?? q.source}
                        <ArrowRight className="w-3 h-3" />
                        {nodes.find(n => n.id === q.target)?.label ?? q.target}
                        {q.resource && <span className="ml-1 px-1 rounded bg-muted text-[9px]">{q.resource}</span>}
                      </div>
                      {/* Hop progress */}
                      {q.hops.length > 0 && (
                        <div className="flex items-center gap-0.5 mt-1">
                          {q.hops.map((h, i) => {
                            const hopNode = nodes.find(n => n.id === h.nodeId);
                            const bgColor = h.status === "done" ? q.color : h.status === "processing" ? q.color : h.status === "entering" ? q.color : h.status === "exiting" ? q.color : h.status === "failed" ? "#dc2626" : "oklch(0.85 0.02 280)";
                            return (
                              <div key={i} className="flex items-center gap-0.5">
                                <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-mono text-white ${h.status === "processing" || h.status === "entering" || h.status === "exiting" ? "animate-pulse" : ""}`} style={{ background: bgColor }} title={`${hopNode?.label ?? h.nodeId}: ${h.status} (${h.latencyMs}ms)`}>
                                  {hopNode?.label ?? "?"}
                                </div>
                                {i < q.hops.length - 1 && <ArrowRight className="w-2 h-2 text-muted-foreground" />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {q.result && (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {q.result.rows} rows · {q.result.latencyMs}ms · {(q.result.bytesTransferred / 1024).toFixed(1)}KB{q.result.fromCache ? " · cached" : ""}
                        </div>
                      )}
                      {q.error && <div className="mt-1 text-[10px] text-red-500">{q.error}</div>}
                      {q.retryCount > 0 && <div className="mt-0.5 text-[10px] text-orange-500">Retries: {q.retryCount}/{q.maxRetries}</div>}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* ── Config Panel ── */}
            <AnimatePresence>
              {showConfigPanel && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="p-3 rounded-lg border border-indigo-500/30 bg-indigo-500/5">
                    <div className="text-[10px] uppercase tracking-wider text-indigo-500 font-semibold mb-2 flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5" /> Simulation Config
                    </div>
                    <div className="space-y-2">
                      <SliderControl label="Tick interval (ms)" value={simConfig.tickMs} min={400} max={4000} step={200} onChange={v => setSimConfig(c => ({ ...c, tickMs: v }))} />
                      <SliderControl label="Hop delay (ms)" value={simConfig.hopDelayMs} min={300} max={3000} step={100} onChange={v => setSimConfig(c => ({ ...c, hopDelayMs: v }))} />
                      <SliderControl label="Processing delay (ms)" value={simConfig.processingDelayMs} min={200} max={2000} step={100} onChange={v => setSimConfig(c => ({ ...c, processingDelayMs: v }))} />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Auto-query mode</span>
                        <button onClick={() => setSimConfig(c => ({ ...c, autoQueryEnabled: !c.autoQueryEnabled }))} className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${simConfig.autoQueryEnabled ? "bg-indigo-500/10 text-indigo-600" : "bg-muted text-muted-foreground"}`}>
                          {simConfig.autoQueryEnabled ? "ON" : "OFF"}
                        </button>
                      </div>
                      {simConfig.autoQueryEnabled && (
                        <>
                          <SliderControl label="Auto-query interval (ms)" value={simConfig.autoQueryInterval} min={1000} max={10000} step={500} onChange={v => setSimConfig(c => ({ ...c, autoQueryInterval: v }))} />
                          <SliderControl label="Max concurrent queries" value={simConfig.maxConcurrentQueries} min={1} max={10} step={1} onChange={v => setSimConfig(c => ({ ...c, maxConcurrentQueries: v }))} />
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Chaos Panel ── */}
            <AnimatePresence>
              {showFailurePanel && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5">
                    <div className="text-[10px] uppercase tracking-wider text-red-500 font-semibold mb-2 flex items-center gap-1.5">
                      <Bug className="w-3.5 h-3.5" /> Chaos Configuration
                    </div>
                    <div className="space-y-2">
                      <SliderControl label="Node drop chance" value={failureConfig.nodeDropChance} min={0} max={0.5} step={0.02} onChange={v => setFailureConfig(c => ({ ...c, nodeDropChance: v }))} />
                      <SliderControl label="Node join chance" value={failureConfig.nodeJoinChance} min={0} max={0.6} step={0.02} onChange={v => setFailureConfig(c => ({ ...c, nodeJoinChance: v }))} />
                      <SliderControl label="Degrade chance" value={failureConfig.degradeChance} min={0} max={0.3} step={0.01} onChange={v => setFailureConfig(c => ({ ...c, degradeChance: v }))} />
                      <SliderControl label="Partition chance" value={failureConfig.partitionChance} min={0} max={0.15} step={0.01} onChange={v => setFailureConfig(c => ({ ...c, partitionChance: v }))} />
                      <SliderControl label="Metric drift range" value={failureConfig.metricDriftRange} min={2} max={60} step={2} onChange={v => setFailureConfig(c => ({ ...c, metricDriftRange: v }))} />
                      <SliderControl label="Ownership transfer" value={failureConfig.ownershipTransferChance} min={0} max={0.2} step={0.01} onChange={v => setFailureConfig(c => ({ ...c, ownershipTransferChance: v }))} />
                      <div className="text-[10px] uppercase tracking-wider text-foreground font-semibold mt-3 mb-1">Manual Injection</div>
                      <div className="flex flex-wrap gap-1">
                        {nodes.filter(n => n.status === "online").map(n => (
                          <button key={n.id} onClick={() => injectNodeFailure(n.id)} className="px-1.5 py-0.5 rounded text-[9px] bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition">
                            Kill {n.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Event Log ── */}
            <div>
              <button onClick={() => setShowEventLog(!showEventLog)} className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-foreground font-semibold mb-1">
                <Activity className="w-3.5 h-3.5 text-indigo-500" />
                Event Log ({events.length})
                {showEventLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              <AnimatePresence>
                {showEventLog && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 200, opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div ref={eventLogRef} className="h-50 overflow-y-auto space-y-0.5 pr-1 text-[10px] font-mono">
                      {events.map(ev => (
                        <div key={ev.id} className={`flex items-start gap-1.5 py-0.5 ${ev.severity === "error" ? "text-red-500" : ev.severity === "warn" ? "text-amber-500" : ev.severity === "success" ? "text-emerald-500" : "text-muted-foreground"}`}>
                          <span className="shrink-0 text-[9px] opacity-60">t={ev.tick}</span>
                          <span>{ev.message}</span>
                        </div>
                      ))}
                      {events.length === 0 && <div className="text-muted-foreground py-2">No events yet. Start the simulation or send a query.</div>}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Routing Rules ── */}
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-foreground mb-1">Routing Rules</div>
              <div className="flex items-start gap-1.5"><span className="text-emerald-500">1.</span> MST for global connectivity</div>
              <div className="flex items-start gap-1.5"><span className="text-blue-500">2.</span> Min-degree ≥ 2 per node</div>
              <div className="flex items-start gap-1.5"><span className="text-purple-500">3.</span> Bypass if direct ≥ 20% faster</div>
              <div className="flex items-start gap-1.5"><span className="text-amber-500">4.</span> Weight = 0.6·latency + 0.25·(1−tp) + 0.15·loss</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Slider control ── */
function SliderControl({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} className="w-full accent-indigo h-1" />
    </div>
  );
}
