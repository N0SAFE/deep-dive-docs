"use client";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Info } from "lucide-react";

/* ─── Types ─── */
type NType = "user" | "api" | "db" | "stream" | "region" | "preview" | "tenant";
type SNode = { id: string; x: number; y: number; label: string; desc: string; type: NType };
type SEdge = { id: string; source: string; target: string; label: string };
type SStep = { title: string; desc: string; nodes: string[]; edges: string[]; events: string[] };
type Scenario = {
  id: string;
  title: string;
  goal: string;
  note: string;
  nodes: SNode[];
  edges: SEdge[];
  steps: SStep[];
};

const TYPE_COLORS: Record<NType, string> = {
  user: "oklch(0.65 0.14 195)",
  api: "oklch(0.60 0.15 250)",
  db: "oklch(0.55 0.15 150)",
  stream: "oklch(0.60 0.18 320)",
  region: "oklch(0.55 0.12 30)",
  preview: "oklch(0.60 0.15 280)",
  tenant: "oklch(0.55 0.12 160)",
};

/* ─── All 10 Scenarios ─── */
const SCENARIOS: Scenario[] = [
  {
    id: "first-connection",
    title: "First Peer Connection",
    goal: "Show how two equal instances become routable through connect + heartbeat + ownership lookup.",
    note: "No control master: API-1 and API-2 run the same code and either one can be entrypoint.",
    nodes: [
      {
        id: "user",
        x: 60,
        y: 200,
        label: "Operator",
        desc: "Can enter from any server",
        type: "user",
      },
      { id: "api-1", x: 280, y: 80, label: "API-1", desc: "Instance A (equal peer)", type: "api" },
      { id: "api-2", x: 280, y: 320, label: "API-2", desc: "Instance B (equal peer)", type: "api" },
      {
        id: "stream",
        x: 520,
        y: 200,
        label: "Owned Stream",
        desc: "/core/mesh/streams/:id/subscribe",
        type: "stream",
      },
    ],
    edges: [
      { id: "u-a1", source: "user", target: "api-1", label: "initial request" },
      { id: "a1-a2", source: "api-1", target: "api-2", label: "connectPeer / resume" },
      { id: "a2-a1", source: "api-2", target: "api-1", label: "heartbeat + metrics" },
      { id: "a2-stream", source: "api-2", target: "stream", label: "direct owner route" },
    ],
    steps: [
      {
        title: "1) Any server can be entrypoint",
        desc: "The operator reaches API-1, but API-2 could have served the same first step. There is no fleet leader.",
        nodes: ["user", "api-1"],
        edges: ["u-a1"],
        events: ["requireAuth() passes", "organization scope checked on entry server"],
      },
      {
        title: "2) Session handshake between equals",
        desc: "API-1 connects to API-2 using endpointUrl/resumeToken. If already active, it deduplicates, otherwise it creates a new connected session.",
        nodes: ["api-1", "api-2"],
        edges: ["a1-a2"],
        events: [
          "connectPeer(endpointUrl, resumeToken?)",
          "dedup by endpointUrl or resume by token",
          "peerSessions + activeSessionByEndpointUrl updated",
        ],
      },
      {
        title: "3) Heartbeat makes route quality real",
        desc: "API-2 sends peerNodeId and link metrics. API-1 computes connection weight and activePathRank for routing decisions.",
        nodes: ["api-1", "api-2"],
        edges: ["a2-a1"],
        events: [
          "heartbeatPeer(sessionId, peerNodeId, metrics)",
          "peerConnections edge upserted",
          "weight + rank recomputed",
        ],
      },
      {
        title: "4) Direct owner resolution (no proxy lock-in)",
        desc: "Entry server looks up owner candidates and sends client traffic to the owner endpoint directly.",
        nodes: ["api-1", "api-2", "stream"],
        edges: ["a2-stream"],
        events: [
          "lookupResource(stream)",
          "planStreamRoute()",
          "ownerServerUrl + endpointPath returned",
        ],
      },
    ],
  },
  {
    id: "mesh-10",
    title: "10-Instance Mesh Algorithm",
    goal: "Demonstrate mesh formation, anti-entropy, weighted path selection, and failure reroute with 10 equal nodes.",
    note: "Every API-N is identical: no coordinator, no singleton router, no primary election requirement for normal operation.",
    nodes: Array.from({ length: 10 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 10;
      return {
        id: `api-${i + 1}`,
        x: 300 + Math.cos(a) * 160,
        y: 200 + Math.sin(a) * 160,
        label: `API-${i + 1}`,
        desc: "equal instance",
        type: "api" as NType,
      };
    }),
    edges: [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `ring-${i}`,
        source: `api-${i + 1}`,
        target: `api-${((i + 1) % 10) + 1}`,
        label: "gossip link",
      })),
      { id: "chord-1-4", source: "api-1", target: "api-4", label: "shortcut" },
      { id: "chord-4-7", source: "api-4", target: "api-7", label: "shortcut" },
      { id: "chord-7-10", source: "api-7", target: "api-10", label: "shortcut" },
    ],
    steps: [
      {
        title: "1) Bootstrap nearest peers",
        desc: "Each node starts by linking to neighbors. Ring links guarantee baseline connectivity from any point.",
        nodes: ["api-1", "api-2", "api-10"],
        edges: ["ring-0", "ring-9"],
        events: ["connectPeer", "hello envelope", "membership snapshot v+1"],
      },
      {
        title: "2) Full membership convergence",
        desc: "Gossip + anti-entropy reconciliation spreads nodes/sessions/resources until all 10 instances converge on near-identical view.",
        nodes: Array.from({ length: 10 }, (_, i) => `api-${i + 1}`),
        edges: Array.from({ length: 10 }, (_, i) => `ring-${i}`),
        events: [
          "publishControlEnvelope(anti_entropy_sync)",
          "reconcileMembership()",
          "skippedStale / mergedNodes tracked",
        ],
      },
      {
        title: "3) Weighted multi-path routing",
        desc: "Shortcut links create extra capacity. Planner selects lowest-weight branches while still keeping alternates.",
        nodes: ["api-1", "api-4", "api-7", "api-10"],
        edges: ["chord-1-4", "chord-4-7", "chord-7-10"],
        events: [
          "heartbeat metrics update weights",
          "planStreamRoute(desiredBranches=3)",
          "selected + candidates returned",
        ],
      },
      {
        title: "4) Link loss and resilient reroute",
        desc: "When one path degrades/down, traffic shifts to alternate links immediately; reconnect attempts happen in parallel.",
        nodes: ["api-4", "api-5", "api-7"],
        edges: ["ring-3", "chord-4-7"],
        events: [
          "disconnectPeer(allowReconnect=true)",
          "nextReconnectAt with backoff+jitter",
          "fallback branch remains active",
        ],
      },
    ],
  },
  {
    id: "org-propagation",
    title: "Organization Discovery",
    goal: "Explain how an organization can be created on one server and become available mesh-wide without a central ownership server.",
    note: "Org write can enter on any instance. That instance becomes temporary originator, not a permanent master.",
    nodes: [
      {
        id: "owner",
        x: 60,
        y: 200,
        label: "Org Owner",
        desc: "Creates organization",
        type: "user",
      },
      {
        id: "api-4",
        x: 260,
        y: 80,
        label: "API-4",
        desc: "Write entrypoint this time",
        type: "api",
      },
      { id: "api-2", x: 260, y: 200, label: "API-2", desc: "Equal replica", type: "api" },
      { id: "api-8", x: 260, y: 320, label: "API-8", desc: "Equal replica", type: "api" },
      {
        id: "org-a",
        x: 520,
        y: 80,
        label: "Org @ API-4",
        desc: "org_42 metadata + members",
        type: "db",
      },
      { id: "org-b", x: 520, y: 200, label: "Org @ API-2", desc: "replicated copy", type: "db" },
      { id: "org-c", x: 520, y: 320, label: "Org @ API-8", desc: "replicated copy", type: "db" },
    ],
    edges: [
      { id: "owner-write", source: "owner", target: "api-4", label: "create org" },
      { id: "api4-orgA", source: "api-4", target: "org-a", label: "local commit" },
      { id: "api4-api2", source: "api-4", target: "api-2", label: "gossip event" },
      { id: "api4-api8", source: "api-4", target: "api-8", label: "gossip event" },
      { id: "api2-orgB", source: "api-2", target: "org-b", label: "apply replicated change" },
      { id: "api8-orgC", source: "api-8", target: "org-c", label: "apply replicated change" },
    ],
    steps: [
      {
        title: "1) Org create accepted on API-4",
        desc: "Owner sends create-org command to API-4. API-4 validates ownership/auth policy and commits locally.",
        nodes: ["owner", "api-4", "org-a"],
        edges: ["owner-write", "api4-orgA"],
        events: [
          "requireAuth + org policy",
          "organization row created",
          "membership event prepared",
        ],
      },
      {
        title: "2) Change is announced to peers",
        desc: "API-4 emits topology/control events. API-2 and API-8 fetch/apply missing updates via anti-entropy.",
        nodes: ["api-4", "api-2", "api-8"],
        edges: ["api4-api2", "api4-api8"],
        events: [
          "publishControlEnvelope()",
          "reconcileMembership()",
          "resource index upsert for org-owned streams",
        ],
      },
      {
        title: "3) Org is readable from any node",
        desc: "After convergence, reads from API-2/API-8 return the same org ownership model; request can start anywhere.",
        nodes: ["org-a", "org-b", "org-c", "api-2", "api-8"],
        edges: ["api2-orgB", "api8-orgC"],
        events: [
          "consistent org membership checks",
          "owner/member permissions enforce identically on each node",
        ],
      },
    ],
  },
  {
    id: "shared-super-admin-login",
    title: "Shared Super-Admin Login",
    goal: "Explain multi-instance login where super-admin identity is shared and recognized by every server.",
    note: "Super-admin identity material is shared/replicated. Any instance can authenticate and issue session context.",
    nodes: [
      {
        id: "super-admin",
        x: 60,
        y: 200,
        label: "Super Admin",
        desc: "first login attempt",
        type: "user",
      },
      { id: "api-3", x: 260, y: 90, label: "API-3", desc: "receives login request", type: "api" },
      { id: "api-6", x: 260, y: 310, label: "API-6", desc: "peer verifier", type: "api" },
      { id: "api-9", x: 460, y: 200, label: "API-9", desc: "peer verifier", type: "api" },
      {
        id: "token",
        x: 620,
        y: 200,
        label: "Mesh Session",
        desc: "session accepted on all peers",
        type: "stream",
      },
    ],
    edges: [
      { id: "sa-login", source: "super-admin", target: "api-3", label: "login POST" },
      { id: "a3-a6", source: "api-3", target: "api-6", label: "session propagation" },
      { id: "a3-a9", source: "api-3", target: "api-9", label: "session propagation" },
      { id: "a6-token", source: "api-6", target: "token", label: "accept jti/session" },
      { id: "a9-token", source: "api-9", target: "token", label: "accept jti/session" },
    ],
    steps: [
      {
        title: "1) First login can hit any instance",
        desc: "Super-admin submits credentials to API-3 (could be any node). API-3 validates using shared identity source.",
        nodes: ["super-admin", "api-3"],
        edges: ["sa-login"],
        events: [
          "credential verification",
          "super-admin role resolution",
          "initial auth session built",
        ],
      },
      {
        title: "2) Session context is shared mesh-wide",
        desc: "API-3 spreads session context/jti to peers. This avoids sticky routing requirements for privileged operators.",
        nodes: ["api-3", "api-6", "api-9"],
        edges: ["a3-a6", "a3-a9"],
        events: [
          "remoteAuthSession metadata sync",
          "mesh runtime event emitted",
          "peers cache acceptance window",
        ],
      },
      {
        title: "3) Any peer accepts subsequent admin actions",
        desc: "Admin can move to API-6/API-9 and continue safely. Authorization checks still run per request, per org scope.",
        nodes: ["api-6", "api-9", "token"],
        edges: ["a6-token", "a9-token"],
        events: [
          "requireAuth() on each request",
          "org/project permission check remains local+deterministic",
        ],
      },
    ],
  },
  {
    id: "event-distribution",
    title: "Event Discovery & Subscription",
    goal: "Show how any node can discover event ownership, then route live subscription with either redirect-to-owner or seamless server-to-server bridge.",
    note: "All nodes keep open mesh links for continuous discovery. Entry node is arbitrary; ownership can live anywhere.",
    nodes: [
      {
        id: "client",
        x: 30,
        y: 200,
        label: "Client App",
        desc: "subscribe to deployment stream",
        type: "user",
      },
      {
        id: "server-1",
        x: 200,
        y: 200,
        label: "Server-1",
        desc: "entrypoint / query + discover",
        type: "api",
      },
      { id: "server-2", x: 380, y: 80, label: "Server-2", desc: "peer index replica", type: "api" },
      {
        id: "server-3",
        x: 380,
        y: 320,
        label: "Server-3",
        desc: "peer index replica",
        type: "api",
      },
      {
        id: "server-4",
        x: 560,
        y: 200,
        label: "Server-4",
        desc: "event owner in memory",
        type: "api",
      },
      {
        id: "event",
        x: 720,
        y: 200,
        label: "event://deploy/abc",
        desc: "hot stream in owner memory",
        type: "stream",
      },
    ],
    edges: [
      { id: "client-s1", source: "client", target: "server-1", label: "subscribe request" },
      { id: "s1-s2", source: "server-1", target: "server-2", label: "who owns event?" },
      { id: "s1-s3", source: "server-1", target: "server-3", label: "who owns event?" },
      { id: "s2-s4", source: "server-2", target: "server-4", label: "owner candidate=server-4" },
      { id: "s3-s4", source: "server-3", target: "server-4", label: "owner candidate=server-4" },
      { id: "s1-redirect", source: "server-1", target: "client", label: "owner endpoint response" },
      {
        id: "client-s4",
        source: "client",
        target: "server-4",
        label: "direct subscribe (redirect)",
      },
      { id: "s1-s4-bridge", source: "server-1", target: "server-4", label: "open stream bridge" },
      { id: "s4-event", source: "server-4", target: "event", label: "read owner memory stream" },
      { id: "s4-s1-stream", source: "server-4", target: "server-1", label: "forward event frames" },
      {
        id: "s1-client-stream",
        source: "server-1",
        target: "client",
        label: "deliver stream frames",
      },
    ],
    steps: [
      {
        title: "1) Subscribe can start from any server",
        desc: "Client connects to Server-1, but this could be any reachable node. Mesh links stay open for fast discovery at all times.",
        nodes: ["client", "server-1"],
        edges: ["client-s1"],
        events: [
          "subscribe(eventKey=deployments/abc) hits entry server",
          "entry node validates auth/org scope",
          "lookup starts from local index + open mesh peers",
        ],
      },
      {
        title: "2) Mesh discovers who owns the stream",
        desc: "Server-1 queries peer indexes. Server-2/Server-3 confirm Server-4 is owner for this event stream currently held in memory.",
        nodes: ["server-1", "server-2", "server-3", "server-4"],
        edges: ["s1-s2", "s1-s3", "s2-s4", "s3-s4"],
        events: [
          "queryResourceOwners(eventKey)",
          "owner candidate ranking from mesh metadata",
          "owner endpoint + capability returned to entry node",
        ],
      },
      {
        title: "3) Option A: redirect client to owner",
        desc: "Server-1 answers with owner endpoint (Server-4). Client reconnects directly for shortest path and minimal relay overhead.",
        nodes: ["server-1", "client", "server-4", "event"],
        edges: ["s1-redirect", "client-s4", "s4-event"],
        events: [
          "response contains ownerServerUrl + subscribePath",
          "client opens direct stream to owner",
          "events emitted from owner memory to client",
        ],
      },
      {
        title: "4) Option B: bridge stream through mesh",
        desc: "If redirection is undesirable, Server-1 opens a durable stream bridge to Server-4. Client stays connected to Server-1 with no interruption.",
        nodes: ["server-1", "server-4", "event", "client"],
        edges: ["s1-s4-bridge", "s4-event", "s4-s1-stream", "s1-client-stream"],
        events: [
          "entry↔owner stream tunnel established",
          "owner pushes event frames to entry node",
          "entry relays frames to client while keeping local session stable",
        ],
      },
    ],
  },
  {
    id: "env-promotion",
    title: "Env Promotion: dev → staging → prod",
    goal: "Illustrate how ownership and stream/event metadata move across environments while keeping mesh discovery always available.",
    note: "Each environment has equal peers; promotion updates ownership/resource metadata, not a central routing table.",
    nodes: [
      {
        id: "dev-a",
        x: 80,
        y: 80,
        label: "DEV-A",
        desc: "feature builds + smoke streams",
        type: "preview",
      },
      { id: "dev-b", x: 80, y: 280, label: "DEV-B", desc: "dev peer", type: "preview" },
      {
        id: "stg-a",
        x: 300,
        y: 80,
        label: "STG-A",
        desc: "pre-prod validation owner",
        type: "api",
      },
      { id: "stg-b", x: 300, y: 280, label: "STG-B", desc: "staging peer", type: "api" },
      {
        id: "prod-a",
        x: 520,
        y: 80,
        label: "PROD-A",
        desc: "production owner candidate",
        type: "api",
      },
      { id: "prod-b", x: 520, y: 280, label: "PROD-B", desc: "production peer", type: "api" },
      {
        id: "consumer",
        x: 700,
        y: 180,
        label: "Client Consumer",
        desc: "subscribes from anywhere",
        type: "user",
      },
    ],
    edges: [
      { id: "dev-sync", source: "dev-a", target: "dev-b", label: "dev mesh sync" },
      { id: "dev-to-stg", source: "dev-a", target: "stg-a", label: "promote metadata" },
      { id: "stg-sync", source: "stg-a", target: "stg-b", label: "staging sync" },
      { id: "stg-to-prod", source: "stg-a", target: "prod-a", label: "approved promotion" },
      { id: "prod-sync", source: "prod-a", target: "prod-b", label: "prod mesh sync" },
      {
        id: "consumer-any",
        source: "consumer",
        target: "dev-b",
        label: "entrypoint can be any node",
      },
      { id: "discover-prod", source: "dev-b", target: "prod-a", label: "discover final owner" },
      { id: "consumer-prod", source: "consumer", target: "prod-a", label: "direct prod stream" },
    ],
    steps: [
      {
        title: "1) Dev ownership starts local",
        desc: "Dev peers own early event streams and keep resource index entries warm for quick discovery.",
        nodes: ["dev-a", "dev-b"],
        edges: ["dev-sync"],
        events: [
          "upsertResourceIndex(dev)",
          "heartbeat updates quality",
          "list/subscribe events in dev",
        ],
      },
      {
        title: "2) Promotion updates owner metadata",
        desc: "After validation, ownership metadata is promoted to staging then production while mesh discovery remains continuous.",
        nodes: ["dev-a", "stg-a", "stg-b", "prod-a", "prod-b"],
        edges: ["dev-to-stg", "stg-sync", "stg-to-prod", "prod-sync"],
        events: [
          "publish promotion envelope",
          "reconcileMembership across env edges",
          "new owner candidates ranked",
        ],
      },
      {
        title: "3) Client enters anywhere, lands on prod owner",
        desc: "A client entering from a dev-side gateway still discovers the production owner and subscribes directly.",
        nodes: ["consumer", "dev-b", "prod-a"],
        edges: ["consumer-any", "discover-prod", "consumer-prod"],
        events: ["lookupResource(stream)", "planStreamRoute()", "direct owner subscription"],
      },
    ],
  },
  {
    id: "multi-region",
    title: "Multi-Region Production Mesh",
    goal: "Show region-aware discovery where local region is preferred but remote region can instantly serve on degradation.",
    note: "No global leader region. Each region can discover and serve resources with weighted locality preference.",
    nodes: [
      { id: "eu-1", x: 100, y: 80, label: "EU-1", desc: "eu-west owner candidate", type: "region" },
      { id: "eu-2", x: 100, y: 280, label: "EU-2", desc: "eu-west peer", type: "region" },
      { id: "us-1", x: 350, y: 80, label: "US-1", desc: "us-east owner candidate", type: "region" },
      { id: "us-2", x: 350, y: 280, label: "US-2", desc: "us-east peer", type: "region" },
      {
        id: "ap-1",
        x: 600,
        y: 180,
        label: "AP-1",
        desc: "ap-south fallback region",
        type: "region",
      },
      {
        id: "global-user",
        x: 780,
        y: 180,
        label: "Global User",
        desc: "can enter nearest region",
        type: "user",
      },
    ],
    edges: [
      { id: "eu-sync", source: "eu-1", target: "eu-2", label: "regional sync" },
      { id: "us-sync", source: "us-1", target: "us-2", label: "regional sync" },
      { id: "eu-us", source: "eu-1", target: "us-1", label: "inter-region backbone" },
      { id: "us-ap", source: "us-1", target: "ap-1", label: "inter-region backbone" },
      { id: "eu-ap", source: "eu-2", target: "ap-1", label: "inter-region backup" },
      { id: "user-eu", source: "global-user", target: "eu-2", label: "nearest entry" },
      { id: "eu-local", source: "eu-2", target: "eu-1", label: "local low-latency path" },
      { id: "eu-remote", source: "eu-2", target: "us-1", label: "remote bypass if faster" },
    ],
    steps: [
      {
        title: "1) Regional baseline sync",
        desc: "Each region keeps local ownership info fresh and shares summarized metadata across backbones.",
        nodes: ["eu-1", "eu-2", "us-1", "us-2", "ap-1"],
        edges: ["eu-sync", "us-sync", "eu-us", "us-ap", "eu-ap"],
        events: ["region heartbeat", "owner index exchange", "capacity gossip"],
      },
      {
        title: "2) User enters nearest edge",
        desc: "Entry node starts local-route first, then checks for bypass if remote path becomes significantly faster.",
        nodes: ["global-user", "eu-2", "eu-1", "us-1"],
        edges: ["user-eu", "eu-local", "eu-remote"],
        events: [
          "planStreamRoute with locality bias",
          "bypass check (20% faster)",
          "selected owner route",
        ],
      },
      {
        title: "3) Regional degradation recovery",
        desc: "If EU owner degrades, mesh instantly pivots to US/AP candidate while keeping subscription continuity.",
        nodes: ["eu-2", "us-1", "ap-1"],
        edges: ["eu-remote", "us-ap"],
        events: ["disconnectPeer allowReconnect", "candidate re-rank", "seamless failover route"],
      },
    ],
  },
  {
    id: "preview-burst",
    title: "Preview Environment Burst",
    goal: "Demonstrate rapid creation/removal of short-lived preview servers and continuous ownership discovery.",
    note: "Preview nodes join as equals, publish ownership/resources, then leave cleanly without central broker edits.",
    nodes: [
      {
        id: "gateway",
        x: 80,
        y: 180,
        label: "Gateway Node",
        desc: "entry for preview consumers",
        type: "api",
      },
      { id: "pr-201", x: 300, y: 60, label: "PR-201", desc: "preview owner", type: "preview" },
      { id: "pr-202", x: 300, y: 180, label: "PR-202", desc: "preview owner", type: "preview" },
      { id: "pr-203", x: 300, y: 300, label: "PR-203", desc: "preview owner", type: "preview" },
      {
        id: "stable",
        x: 540,
        y: 180,
        label: "Stable Node",
        desc: "fallback + index retention",
        type: "api",
      },
      {
        id: "qa-user",
        x: 720,
        y: 180,
        label: "QA User",
        desc: "subscribes to preview events",
        type: "user",
      },
    ],
    edges: [
      { id: "gw-pr201", source: "gateway", target: "pr-201", label: "discover PR-201 owner" },
      { id: "gw-pr202", source: "gateway", target: "pr-202", label: "discover PR-202 owner" },
      { id: "gw-pr203", source: "gateway", target: "pr-203", label: "discover PR-203 owner" },
      { id: "pr-stable", source: "pr-202", target: "stable", label: "index handoff" },
      { id: "qa-gw", source: "qa-user", target: "gateway", label: "subscribe by PR key" },
      { id: "qa-direct", source: "qa-user", target: "pr-202", label: "direct stream when alive" },
      { id: "qa-fallback", source: "qa-user", target: "stable", label: "fallback when PR expires" },
    ],
    steps: [
      {
        title: "1) Previews join quickly",
        desc: "New preview nodes announce themselves and upsert stream/resource ownership indexes immediately.",
        nodes: ["gateway", "pr-201", "pr-202", "pr-203"],
        edges: ["gw-pr201", "gw-pr202", "gw-pr203"],
        events: [
          "hello envelopes for preview nodes",
          "upsertResourceIndex(stream:pr-*)",
          "owner lookup becomes available",
        ],
      },
      {
        title: "2) QA subscribes from gateway",
        desc: "QA user asks by preview key; gateway resolves current owner and routes directly when possible.",
        nodes: ["qa-user", "gateway", "pr-202"],
        edges: ["qa-gw", "gw-pr202", "qa-direct"],
        events: ["lookup by PR key", "plan route to preview owner", "direct event stream"],
      },
      {
        title: "3) Preview expires, fallback continues",
        desc: "On preview teardown, ownership is removed and stable node serves remaining telemetry/history streams.",
        nodes: ["pr-202", "stable", "qa-user"],
        edges: ["pr-stable", "qa-fallback"],
        events: [
          "membership_remove for preview",
          "resource index eviction",
          "fallback subscription path",
        ],
      },
    ],
  },
  {
    id: "tenant-isolation",
    title: "Multi-Tenant Isolation",
    goal: "Explain shared infrastructure with strict tenant/org isolation and per-tenant event ownership discovery.",
    note: "Nodes are shared but policy enforcement is local and deterministic on every server for each tenant/org scope.",
    nodes: [
      {
        id: "tenant-a",
        x: 60,
        y: 100,
        label: "Tenant-A User",
        desc: "org A scope",
        type: "tenant",
      },
      {
        id: "tenant-b",
        x: 60,
        y: 300,
        label: "Tenant-B User",
        desc: "org B scope",
        type: "tenant",
      },
      {
        id: "shared-1",
        x: 300,
        y: 80,
        label: "Shared-1",
        desc: "mesh peer (policy aware)",
        type: "api",
      },
      {
        id: "shared-2",
        x: 300,
        y: 300,
        label: "Shared-2",
        desc: "mesh peer (policy aware)",
        type: "api",
      },
      { id: "owner-a", x: 560, y: 80, label: "Owner-A", desc: "org A streams", type: "stream" },
      { id: "owner-b", x: 560, y: 300, label: "Owner-B", desc: "org B streams", type: "stream" },
    ],
    edges: [
      { id: "a-entry", source: "tenant-a", target: "shared-1", label: "tenant A request" },
      { id: "b-entry", source: "tenant-b", target: "shared-2", label: "tenant B request" },
      { id: "shared-mesh", source: "shared-1", target: "shared-2", label: "shared discovery mesh" },
      { id: "discover-a", source: "shared-1", target: "owner-a", label: "discover org A owner" },
      { id: "discover-b", source: "shared-2", target: "owner-b", label: "discover org B owner" },
      { id: "a-stream", source: "tenant-a", target: "owner-a", label: "tenant A stream" },
      { id: "b-stream", source: "tenant-b", target: "owner-b", label: "tenant B stream" },
    ],
    steps: [
      {
        title: "1) Tenant-scoped entry",
        desc: "Both tenants enter shared mesh nodes, but auth + org checks partition visibility and candidate owners.",
        nodes: ["tenant-a", "tenant-b", "shared-1", "shared-2"],
        edges: ["a-entry", "b-entry", "shared-mesh"],
        events: ["requireAuth", "organization membership check", "tenant-scoped lookup query"],
      },
      {
        title: "2) Ownership discovery stays scoped",
        desc: "Shared nodes discover owner-A for tenant A and owner-B for tenant B without cross-tenant leakage.",
        nodes: ["shared-1", "shared-2", "owner-a", "owner-b"],
        edges: ["discover-a", "discover-b"],
        events: ["lookupResource with org filter", "owner candidates filtered by tenant scope"],
      },
      {
        title: "3) Streaming from anywhere, still isolated",
        desc: "Each tenant streams directly to its owner while mesh remains shared and decentralized.",
        nodes: ["tenant-a", "owner-a", "tenant-b", "owner-b"],
        edges: ["a-stream", "b-stream"],
        events: ["direct subscription to scoped owner", "policy check on every frame path"],
      },
    ],
  },
  {
    id: "disaster-recovery",
    title: "Disaster Recovery (Primary → DR)",
    goal: "Model DR failover where primary environment goes down and mesh discovery promotes DR owners with minimal interruption.",
    note: "Primary and DR both participate as peers ahead of time; DR activation is route/ownership switch, not central rebuild.",
    nodes: [
      {
        id: "user-dr",
        x: 60,
        y: 180,
        label: "Ops User",
        desc: "active stream consumer",
        type: "user",
      },
      {
        id: "primary-a",
        x: 260,
        y: 80,
        label: "Primary-A",
        desc: "active owner before incident",
        type: "api",
      },
      { id: "primary-b", x: 260, y: 280, label: "Primary-B", desc: "primary peer", type: "api" },
      { id: "dr-a", x: 480, y: 80, label: "DR-A", desc: "warm standby owner", type: "api" },
      { id: "dr-b", x: 480, y: 280, label: "DR-B", desc: "DR peer", type: "api" },
      {
        id: "archive",
        x: 680,
        y: 180,
        label: "Recovery Archive",
        desc: "state snapshots + replay",
        type: "db",
      },
    ],
    edges: [
      { id: "user-primary", source: "user-dr", target: "primary-a", label: "normal stream path" },
      { id: "primary-sync", source: "primary-a", target: "primary-b", label: "primary sync" },
      {
        id: "cross-repl",
        source: "primary-b",
        target: "dr-a",
        label: "replication + ownership mirror",
      },
      { id: "dr-sync", source: "dr-a", target: "dr-b", label: "DR sync" },
      { id: "dr-archive", source: "dr-a", target: "archive", label: "snapshot/replay source" },
      {
        id: "user-dr-route",
        source: "user-dr",
        target: "dr-a",
        label: "post-failover stream path",
      },
    ],
    steps: [
      {
        title: "1) Normal primary ownership",
        desc: "User streams from primary owner while cross-env replication keeps DR candidates up to date.",
        nodes: ["user-dr", "primary-a", "primary-b", "dr-a"],
        edges: ["user-primary", "primary-sync", "cross-repl"],
        events: [
          "active stream in primary",
          "continuous replication to DR",
          "DR owner metadata warm",
        ],
      },
      {
        title: "2) Primary incident detected",
        desc: "Primary degrades/down; mesh removes unhealthy owners and promotes DR owner candidates automatically.",
        nodes: ["primary-a", "dr-a", "dr-b"],
        edges: ["cross-repl", "dr-sync"],
        events: ["membership_suspect/remove", "resource owner re-rank", "route plan pivots to DR"],
      },
      {
        title: "3) Stream resumes from DR",
        desc: "User continues through DR route, optionally replaying short gaps from archive-backed snapshot stream.",
        nodes: ["user-dr", "dr-a", "archive"],
        edges: ["user-dr-route", "dr-archive"],
        events: ["direct DR subscription", "optional replay window", "steady-state DR serving"],
      },
    ],
  },
];

/* ─── Component ─── */
export function CoreSyncSystem() {
  const [activeId, setActiveId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((s) => s.id === activeId)!;
  const [stepIndex, setStepIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const step = scenario.steps[stepIndex];

  useEffect(() => {
    setStepIndex(0);
    setAutoPlay(false);
  }, [activeId]);

  useEffect(() => {
    if (!autoPlay) return;
    const t = setInterval(() => {
      setStepIndex((cur) => {
        if (cur >= scenario.steps.length - 1) {
          setAutoPlay(false);
          return cur;
        }
        return cur + 1;
      });
    }, 2800);
    return () => clearInterval(t);
  }, [autoPlay, scenario.steps.length]);

  const next = () => setStepIndex((s) => Math.min(scenario.steps.length - 1, s + 1));
  const prev = () => setStepIndex((s) => Math.max(0, s - 1));

  return (
    <div className="my-8 overflow-hidden rounded-xl border border-border bg-surface/30 shadow-sm">
      {/* Scenario tabs */}
      <div className="flex overflow-x-auto gap-1 p-3 border-b border-border/60 bg-surface/50">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              s.id === activeId
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Graph area */}
        <div className="flex-1 min-h-[420px] relative bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
          <svg viewBox="0 0 800 400" className="absolute inset-0 w-full h-full">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="oklch(0.5 0.04 280)" />
              </marker>
              <marker
                id="arrowhead-active"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="var(--indigo)" />
              </marker>
            </defs>

            {/* Edges */}
            {scenario.edges.map((e) => {
              const src = scenario.nodes.find((n) => n.id === e.source)!;
              const tgt = scenario.nodes.find((n) => n.id === e.target)!;
              const isActive = step.edges.includes(e.id);
              const cx = (src.x + tgt.x) / 2;
              const cy = (src.y + tgt.y) / 2;

              return (
                <g key={e.id}>
                  <motion.line
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke={isActive ? "var(--indigo)" : "oklch(0.7 0.02 280)"}
                    strokeWidth={isActive ? 2 : 1}
                    strokeDasharray={isActive ? undefined : "4 4"}
                    markerEnd={isActive ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                    opacity={isActive ? 1 : 0.25}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1, opacity: isActive ? 1 : 0.25 }}
                    transition={{ duration: 0.4 }}
                  />
                  {isActive && (
                    <motion.g
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.15 }}
                    >
                      <rect
                        x={cx - 44}
                        y={cy - 10}
                        width="88"
                        height="20"
                        rx="4"
                        fill="oklch(var(--surface))"
                        stroke="var(--indigo)"
                        strokeWidth="0.5"
                      />
                      <text
                        x={cx}
                        y={cy + 3}
                        textAnchor="middle"
                        fontSize="8"
                        fill="var(--indigo)"
                        className="font-mono"
                      >
                        {e.label}
                      </text>
                    </motion.g>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {scenario.nodes.map((n) => {
              const isActive = step.nodes.includes(n.id);
              const color = TYPE_COLORS[n.type];
              return (
                <motion.g
                  key={n.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isActive ? 1 : 0.35 }}
                  transition={{ duration: 0.3 }}
                >
                  {isActive && (
                    <motion.circle
                      cx={n.x}
                      cy={n.y}
                      r={28}
                      fill={color}
                      fillOpacity={0.12}
                      animate={{ r: [28, 38, 28], opacity: [0.12, 0, 0.12] }}
                      transition={{ duration: 2.2, repeat: Infinity }}
                    />
                  )}
                  <rect
                    x={n.x - 34}
                    y={n.y - 28}
                    width="68"
                    height="56"
                    rx="14"
                    fill="oklch(var(--surface))"
                    stroke={isActive ? color : "oklch(0.8 0.02 280)"}
                    strokeWidth={isActive ? 2 : 1}
                  />
                  <text
                    x={n.x}
                    y={n.y - 4}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight={isActive ? "600" : "500"}
                    fill="currentColor"
                  >
                    {n.label}
                  </text>
                  <text
                    x={n.x}
                    y={n.y + 12}
                    textAnchor="middle"
                    fontSize="8"
                    fill="oklch(var(--muted-foreground))"
                  >
                    {n.desc.length > 28 ? n.desc.slice(0, 26) + "…" : n.desc}
                  </text>
                </motion.g>
              );
            })}
          </svg>
        </div>

        {/* Side panel */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-border/60 bg-surface/50 flex flex-col overflow-y-auto max-h-[600px]">
          <div className="p-4 space-y-4 flex-1">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Info className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold">{scenario.title}</h3>
              </div>
              <p className="text-[11px] text-muted-foreground">{scenario.goal}</p>
            </div>

            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <div className="text-[10px] uppercase tracking-wider text-indigo-500 font-semibold mb-1">
                Decentralization guarantee
              </div>
              <p className="text-[11px] text-indigo-900/70 dark:text-indigo-200/70">
                {scenario.note}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold">
                  Step {stepIndex + 1} / {scenario.steps.length}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setStepIndex(0);
                      setAutoPlay(false);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setAutoPlay(!autoPlay)}
                    className="w-7 h-7 flex items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition"
                  >
                    {autoPlay ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 ml-0.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex gap-1 mb-3">
                {scenario.steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setStepIndex(i);
                      setAutoPlay(false);
                    }}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${i <= stepIndex ? "bg-primary" : "bg-muted"}`}
                  />
                ))}
              </div>

              <h4 className="text-sm font-semibold mb-1">{step.title}</h4>
              <p className="text-[11px] text-muted-foreground mb-3">{step.desc}</p>

              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Runtime events
              </div>
              <div className="flex flex-wrap gap-1.5">
                {step.events.map((ev, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-mono"
                  >
                    {ev}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={prev}
                disabled={stepIndex === 0}
                className="flex-1 px-3 py-1.5 rounded-md border border-border/60 text-xs font-medium hover:bg-muted transition disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <ChevronLeft className="w-3 h-3" /> Previous
              </button>
              <button
                onClick={next}
                disabled={stepIndex === scenario.steps.length - 1}
                className="flex-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-1"
              >
                Next <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
