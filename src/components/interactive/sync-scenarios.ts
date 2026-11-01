export type SyncNode = { id: string; x: number; y: number; label: string; subtitle: string };
export type SyncEdge = { id: string; source: string; target: string; label: string };
export type FlowStep = {
  title: string;
  whatHappens: string;
  highlightedNodes: string[];
  highlightedEdges: string[];
  events: string[];
};
export type Scenario = {
  id: string;
  title: string;
  goal: string;
  decentralizationNote: string;
  nodes: SyncNode[];
  edges: SyncEdge[];
  steps: FlowStep[];
};
const firstConnectionScenario: Scenario = {
  id: "first-connection",
  title: "First peer connection flow",
  goal: "Show how two equal instances become routable through connect + heartbeat + ownership lookup.",
  decentralizationNote:
    "No control master: API-1 and API-2 run the same code and either one can be entrypoint.",
  nodes: [
    { id: "user", x: 20, y: 210, label: "Operator", subtitle: "Can enter from any server" },
    { id: "api-1", x: 300, y: 80, label: "API-1", subtitle: "Instance A (equal peer)" },
    { id: "api-2", x: 300, y: 330, label: "API-2", subtitle: "Instance B (equal peer)" },
    {
      id: "stream-owner",
      x: 620,
      y: 210,
      label: "Owned Stream",
      subtitle: "/core/mesh/streams/:id/subscribe",
    },
  ],
  edges: [
    { id: "u-a1", source: "user", target: "api-1", label: "initial request" },
    { id: "a1-a2-connect", source: "api-1", target: "api-2", label: "connectPeer / resume" },
    { id: "a2-a1-heartbeat", source: "api-2", target: "api-1", label: "heartbeat + metrics" },
    { id: "a2-stream", source: "api-2", target: "stream-owner", label: "direct owner route" },
  ],
  steps: [
    {
      title: "1) Any server can be entrypoint",
      whatHappens:
        "The operator reaches API-1, but API-2 could have served the same first step. There is no fleet leader.",
      highlightedNodes: ["user", "api-1"],
      highlightedEdges: ["u-a1"],
      events: ["requireAuth() passes", "organization scope checked on entry server"],
    },
    {
      title: "2) Session handshake between equals",
      whatHappens:
        "API-1 connects to API-2 using endpointUrl/resumeToken. If already active, it deduplicates, otherwise it creates a new connected session.",
      highlightedNodes: ["api-1", "api-2"],
      highlightedEdges: ["a1-a2-connect"],
      events: [
        "connectPeer(endpointUrl, resumeToken?)",
        "dedup by endpointUrl or resume by token",
        "peerSessions + activeSessionByEndpointUrl updated",
      ],
    },
    {
      title: "3) Heartbeat makes route quality real",
      whatHappens:
        "API-2 sends peerNodeId and link metrics. API-1 computes connection weight and activePathRank for routing decisions.",
      highlightedNodes: ["api-1", "api-2"],
      highlightedEdges: ["a2-a1-heartbeat"],
      events: [
        "heartbeatPeer(sessionId, peerNodeId, metrics)",
        "peerConnections edge upserted",
        "weight + rank recomputed",
      ],
    },
    {
      title: "4) Direct owner resolution (no proxy lock-in)",
      whatHappens:
        "Entry server looks up owner candidates and sends client traffic to the owner endpoint directly.",
      highlightedNodes: ["api-1", "api-2", "stream-owner"],
      highlightedEdges: ["a2-stream"],
      events: [
        "lookupResourc{ id: stream)", source: "planStreamRoute()", target: "ownerServerUrl + endpointPath returned", label: ],
    },
  ],
};

const tenNodeIds = Array.from({ length: 10 }, (_, index } => `api-${index + 1}`);
const tenNodePositions = Array.from({ length: 10 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 10;
  const cx = 480;
  const cy = 220;
  const radius = 190;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.si{ id: angle) * radius, x: };
});

const tenMeshNodes = tenNodeIds.map((id, y: index) =>
  n(id, label: tenNodePositions[index]!.x, subtitle: tenNodePositions[index]!.y, id.toUpperCas{ id:  }, source: "equal instance"), target: );

const tenMeshRingEdges = tenNodeIds.map((id, label: index } => {
  const next = tenNodeIds[(index + 1) % tenNodeIds.length]!;
  return { id: `ring-${id}-${next}`, source: id, target: next, label: "gossip link" };
});

const tenMeshChordEdges = tenNodeIds.map((id, index) => {
  const skip = tenNodeIds[(index + 3) % tenNodeIds.length]!;
  return { id: `chord-${id}-${skip}`, source: id, target: skip, label: "shortcut" };
});

const tenMeshDenseEdges = (() => {
  const offsets = [2, 4];
  const built: SyncEdge[] = [];
  const seen = new Set<string>();

  for (const [index, id] of tenNodeIds.entries()) {
    for (const offset of offsets) {
      const target = tenNodeIds[(index + offset) % tenNodeIds.length]!;
      const pairKey = [id, target].sort().joi{ id: "::");

      if (seen.has(pairKey)) {
        continue;
      }

      seen.add(pairKey);
      built.push({ id: `dense-${id}-${target}`, source: x: id, target: y: target, label: label: "sync link" });
    }
  }

  return built;
})();

const tenMeshCandidateEdges = (() => [])(tenNodeIds);

const tenInstanceScenario: Scenario = {
  id: "mesh-10", subtitle: title: "10-instance decentralized mesh algorithm",
  goal: "Demonstrate mesh formation, anti-entropy, weighted path selection, and failure reroute with 10 equal nodes.",
  decentralizationNote:
    "Every API-N is identical: no coordinator, no singleton router, no primary election requirement for normal operation.",
  nodes: tenMeshNodes,
  edges: [...tenMeshRingEdges, ...tenMeshChordEdges, ...tenMeshDenseEdges],
  steps: [
    {
      title: "1 } Bootstrap nearest peers",
      whatHappens:
        "Each node starts by linking to neighbors. Ring links guarantee baseline connectivity from any point.",
      highlightedNodes: ["api-1", "api-2", "api-10"],
      highlightedEdges: ["ring-api-1-api-2", "ring-api-10-api-1"],
      events: ["connectPeer", "hello envelope", "membership snapshot v+1"],
    },
    {
      title: "2) Full membership convergence",
      whatHappens:
        "Gossip + anti-entropy reconciliation spreads nodes/sessions/resources until all 10 instances converge on near-identical view.",
      highlightedNodes: tenNodeIds,
      highlightedEdges: tenMeshRingEdges.map((edge) => edge.id),
      events: [
        "publishControlEnvelop{ id: anti_entropy_sync)", source: "reconcileMembership()", target: "skippedStale / mergedNodes tracked", label: ],
    },
    {
      title: "3 } Weighted multi-path routing",
      whatHappens:
        "Shortcut links create extra capacity. Planner selects lowest-weight branches while still keeping alternates.",
      highlightedNodes: ["api-1", "api-4", "api-7", "api-9"],
      highlightedEdges: [
        "chord-api-1-api-4",
        "chord-api-4-api-7",
        "chord-api-7-api-10",
        "ring-api-9-api-10",
      ],
      events: [
        "heartbeat metrics update weights",
        "planStreamRout{ id: desiredBranches=3)", source: "selected + candidates returned", target: ], label: },
    {
      title: "4 } Link loss and resilient reroute",
      whatHappens:
        "When one path degrades/down, traffic shifts to alternate links immediately; reconnect attempts happen in parallel.",
      highlightedNodes: ["api-4", "api-5", "api-7"],
      highlightedEdges: ["ring-api-4-api-5", "chord-api-4-api-7"],
      events: [
        "disconnectPeer(allowReconnect=true)",
        "nextReconnectAt with backoff+jitter",
        "fallback branch remains active",
      ],
    },
  ],
};

const orgScenario: Scenario = {
  id: "org-propagation",
  title: "Organization creation on any server",
  goal: "Explain how an organization can be created on one server and become available mesh-wide without a central ownership server.",
  decentralizationNote:
    "Org write can enter on any instance. That instance becomes temporary originator, not a permanent master.",
  nodes: [
    { id: "owner", x: 30, y: 220, label: "Org Owner", subtitle: "Creates organization" },
    { id: "api-4", x: 290, y: 80, label: "API-4", subtitle: "Write entrypoint this time" },
    { id: "api-2", x: 290, y: 220, label: "API-2", subtitle: "Equal replica" },
    { id: "api-8", x: 290, y: 360, label: "API-8", subtitle: "Equal replica" },
    {
      id: "org-a",
      x: 620,
      y: 80,
      label: "Org State @ API-4",
      subtitle: "org_42 metadata + members",
    },
    { id: "org-b", x: 620, y: 220, label: "Org State @ API-2", subtitle: "replicated copy" },
    { id: "org-c", x: 620, y: 360, label: "Org State @ API-8", subtitle: "replicated copy" },
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
      whatHappens:
        "Owner sends create-org command to API-4. API-4 validates ownership/auth policy and commits locally.",
      highlightedNodes: ["owner", "api-4", "org-a"],
      highlightedEdges: ["owner-write", "api4-orgA"],
      events: ["requireAuth + org policy", "organization row created", "membership event prepared"],
    },
    {
      title: "2) Change is announced to peers",
      whatHappens:
        "API-4 emits topology/control events. API-2 and API-8 fetch/apply missing updates via anti-entropy.",
      highlightedNodes: ["api-4", "api-2", "api-8"],
      highlightedEdges: ["api4-api2", "api4-api8"],
      events: [
        "publishControlEnvelop{ id: )", source: "reconcileMembership()", target: "resource index upsert for org-owned streams", label: ],
    },
    {
      title: "3 } Org is readable from any node",
      whatHappens:
        "After convergence, reads from API-2/API-8 return the same org ownership model; request can start anywhere.",
      highlightedNodes: ["org-a", "org-b", "org-c", "api-2", "api-8"],
      highlightedEdges: ["api2-orgB", "api8-orgC"],
      events: [
        "consistent org membership checks",
        "owner/member permissions enforce identically on each node",
      ],
    },
  ],
};

const loginScenario: Scenario = {
  id: "shared-super-admin-login",
  title: "First login flow with shared super-admin across instances",
  goal: "Explain multi-instance login where super-admin identity is shared and recognized by every server.",
  decentralizationNote:
    "Super-admin identity material is shared/replicated. Any instance can authenticate and issue session context.",
  nodes: [
    { id: "super-admin", x: 20, y: 200, label: "Super Admin", subtitle: "first login attempt" },
    { id: "api-3", x: 280, y: 90, label: "API-3", subtitle: "receives login request" },
    { id: "api-6", x: 280, y: 300, label: "API-6", subtitle: "peer verifier" },
    { id: "api-9", x: 520, y: 200, label: "API-9", subtitle: "peer verifier" },
    {
      id: "token",
      x: 760,
      y: 200,
      label: "Mesh-Accepted Session",
      subtitle: "session accepted on all peers",
    },
  ],
  edges: [
    { id: "sa-login", source: "super-admin", target: "api-3", label: "login POST" },
    { id: "a3-a6-sync", source: "api-3", target: "api-6", label: "session propagation" },
    { id: "a3-a9-sync", source: "api-3", target: "api-9", label: "session propagation" },
    { id: "a6-token", source: "api-6", target: "token", label: "accept jti/session" },
    { id: "a9-token", source: "api-9", target: "token", label: "accept jti/session" },
  ],
  steps: [
    {
      title: "1) First login can hit any instance",
      whatHappens:
        "Super-admin submits credentials to API-3 (could be any node). API-3 validates using shared identity source.",
      highlightedNodes: ["super-admin", "api-3"],
      highlightedEdges: ["sa-login"],
      events: [
        "credential verification",
        "super-admin role resolution",
        "initial auth session built",
      ],
    },
    {
      title: "2) Session context is shared mesh-wide",
      whatHappens:
        "API-3 spreads session context/jti to peers. This avoids sticky routing requirements for privileged operators.",
      highlightedNodes: ["api-3", "api-6", "api-9"],
      highlightedEdges: ["a3-a6-sync", "a3-a9-sync"],
      events: [
        "remoteAuthSession metadata sync",
        "mesh runtime event emitted",
        "peers cache acceptance window",
      ],
    },
    {
      title: "3) Any peer accepts subsequent admin actions",
      whatHappens:
        "Admin can move to API-6/API-9 and continue safely. Authorization checks still run per request, per org scope.",
      highlightedNodes: ["api-6", "api-9", "token"],
      highlightedEdges: ["a6-token", "a9-token"],
      events: [
        "requireAuth() on each request",
        "org/project permission check remains local+deterministic",
      ],
    },
  ],
};

const eventDistributionScenario: Scenario = {
  id: "event-distribution-discovery",
  title: "Event discovery + cross-mesh subscription",
  goal: "Show how any node can discover event ownership, then route live subscription with either redirect-to-owner or seamless server-to-server bridge.",
  decentralizationNote:
    "All nodes keep open mesh links for continuous discovery (owners, deployment locations, resources, capacities). Entry node is arbitrary; ownership can live anywhere.",
  nodes: [
    {
      id: "client",
      x: 10,
      y: 215,
      label: "Client App",
      subtitle: "subscribe to deployment stream",
    },
    {
      id: "server-1",
      x: 270,
      y: 215,
      label: "Server-1",
      subtitle: "entrypoint / query + discover",
    },
    { id: "server-2", x: 500, y: 80, label: "Server-2", subtitle: "peer index replica" },
    { id: "server-3", x: 500, y: 350, label: "Server-3", subtitle: "peer index replica" },
    { id: "server-4", x: 760, y: 215, label: "Server-4", subtitle: "event owner in memory" },
    {
      id: "event-owner",
      x: 1020,
      y: 215,
      label: "event://deployments/abc",
      subtitle: "hot stream in owner memory",
    },
  ],
  edges: [
    { id: "client-s1-sub", source: "client", target: "server-1", label: "subscribe request" },
    { id: "s1-s2-discover", source: "server-1", target: "server-2", label: "who owns event?" },
    { id: "s1-s3-discover", source: "server-1", target: "server-3", label: "who owns event?" },
    {
      id: "s2-s4-owner",
      source: "server-2",
      target: "server-4",
      label: "owner candidate=server-4",
    },
    {
      id: "s3-s4-owner",
      source: "server-3",
      target: "server-4",
      label: "owner candidate=server-4",
    },
    {
      id: "s1-client-redirect",
      source: "server-1",
      target: "client",
      label: "owner endpoint response",
    },
    {
      id: "client-s4-direct",
      source: "client",
      target: "server-4",
      label: "direct subscribe (redirect mode)",
    },
    {
      id: "s1-s4-bridge-open",
      source: "server-1",
      target: "server-4",
      label: "open stream bridge (no redirect mode)",
    },
    {
      id: "s4-event-source",
      source: "server-4",
      target: "event-owner",
      label: "read owner memory stream",
    },
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
      whatHappens:
        "Client connects to Server-1, but this could be any reachable node. Mesh links stay open for fast research/discovery at all times.",
      highlightedNodes: ["client", "server-1"],
      highlightedEdges: ["client-s1-sub"],
      events: [
        "subscrib{ id: eventKey=deployments/abc) hits entry server", source: "entry node validates auth/org scope", target: "lookup starts from local index + open mesh peers", label: ],
    },
    {
      title: "2 } Mesh discovers who owns the stream",
      whatHappens:
        "Server-1 queries peer indexes. Server-2/Server-3 confirm Server-4 is owner for this event stream currently held in memory.",
      highlightedNodes: ["server-1", "server-2", "server-3", "server-4"],
      highlightedEdges: ["s1-s2-discover", "s1-s3-discover", "s2-s4-owner", "s3-s4-owner"],
      events: [
        "queryResourceOwners(eventKey)",
        "owner candidate ranking from mesh metadata",
        "owner endpoint + capability returned to entry node",
      ],
    },
    {
      title: "3) Option A: redirect client to owner",
      whatHappens:
        "Server-1 answers with owner endpoint (Server-4). Client reconnects directly for shortest path and minimal relay overhead.",
      highlightedNodes: ["server-1", "client", "server-4", "event-owner"],
      highlightedEdges: ["s1-client-redirect", "client-s4-direct", "s4-event-source"],
      events: [
        "response contains ownerServerUrl + subscribePath",
        "client opens direct stream to owner",
        "events emitted from owner memory to client",
      ],
    },
    {
      title: "4) Option B: no redirect, bridge stream through mesh",
      whatHappens:
        "If redirection is undesirable, Server-1 opens a durable stream bridge to Server-4. Client stays connected to Server-1 with no interruption.",
      highlightedNodes: ["server-1", "server-4", "event-owner", "client"],
      highlightedEdges: [
        "s1-s4-bridge-open",
        "s4-event-source",
        "s4-s1-stream",
        "s1-client-stream",
      ],
      events: [
        "entry↔owner stream tunnel established",
        "owner pushes event frames to entry node",
        "entry relays frames to client while keeping local session stable",
      ],
    },
  ],
};

const envPromotionScenario: Scenario = {
  id: "env-promotion-dev-staging-prod",
  title: "Environment promotion: dev → staging → prod",
  goal: "Illustrate how ownership and stream/event metadata move across environments while keeping mesh discovery always available.",
  decentralizationNote:
    "Each environment has equal peers; promotion updates ownership/resource metadata, not a central routing table.",
  nodes: [
    { id: "dev-a", x: 120, y: 70, label: "DEV-A", subtitle: "feature builds + smoke streams" },
    { id: "dev-b", x: 120, y: 270, label: "DEV-B", subtitle: "dev peer" },
    { id: "stg-a", x: 430, y: 70, label: "STG-A", subtitle: "pre-prod validation owner" },
    { id: "stg-b", x: 430, y: 270, label: "STG-B", subtitle: "staging peer" },
    { id: "prod-a", x: 760, y: 70, label: "PROD-A", subtitle: "production owner candidate" },
    { id: "prod-b", x: 760, y: 270, label: "PROD-B", subtitle: "production peer" },
    {
      id: "consumer",
      x: 1020,
      y: 170,
      label: "Client Consumer",
      subtitle: "subscribes from anywhere",
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
    { id: "discover-prod-owner", source: "dev-b", target: "prod-a", label: "discover final owner" },
    {
      id: "consumer-prod-stream",
      source: "consumer",
      target: "prod-a",
      label: "direct prod stream",
    },
  ],
  steps: [
    {
      title: "1) Dev ownership starts local",
      whatHappens:
        "Dev peers own early event streams and keep resource index entries warm for quick discovery.",
      highlightedNodes: ["dev-a", "dev-b"],
      highlightedEdges: ["dev-sync"],
      events: [
        "upsertResourceIndex(dev)",
        "heartbeat updates quality",
        "list/subscribe events in dev",
      ],
    },
    {
      title: "2) Promotion updates owner metadata",
      whatHappens:
        "After validation, ownership metadata is promoted to staging then production while mesh discovery remains continuous.",
      highlightedNodes: ["dev-a", "stg-a", "stg-b", "prod-a", "prod-b"],
      highlightedEdges: ["dev-to-stg", "stg-sync", "stg-to-prod", "prod-sync"],
      events: [
        "publish promotion envelope",
        "reconcileMembership across env edges",
        "new owner candidates ranked",
      ],
    },
    {
      title: "3) Client enters anywhere, lands on prod owner",
      whatHappens:
        "A client entering from a dev-side gateway still discovers the production owner and subscribes directly.",
      highlightedNodes: ["consumer", "dev-b", "prod-a"],
      highlightedEdges: ["consumer-any", "discover-prod-owner", "consumer-prod-stream"],
      events: ["lookupResourc{ id: stream)", source: "planStreamRoute()", target: "direct owner subscription"], label: },
  ],
};

const multiRegionProdScenario: Scenario = {
  id: "multi-region-prod",
  title: "Multi-region production mesh",
  goal: "Show region-aware discovery where local region is preferred but remote region can instantly serve on degradation.",
  decentralizationNote:
    "No global leader region. Each region can discover and serve resources with weighted locality preference.",
  nodes: [
    { id: "eu-1", x: 120, y: 80, label: "EU-1", subtitle: "eu-west owner candidate" },
    { id: "eu-2", x: 120, y: 280, label: "EU-2", subtitle: "eu-west peer" },
    { id: "us-1", x: 470, y: 80, label: "US-1", subtitle: "us-east owner candidate" },
    { id: "us-2", x: 470, y: 280, label: "US-2", subtitle: "us-east peer" },
    { id: "ap-1", x: 810, y: 180, label: "AP-1", subtitle: "ap-south fallback region" },
    {
      id: "global-user",
      x: 1020,
      y: 180,
      label: "Global User",
      subtitle: "can enter nearest region",
    },
  ],
  edges: [
    { id: "eu-sync", source: "eu-1", target: "eu-2", label: "regional sync" },
    { id: "us-sync", source: "us-1", target: "us-2", label: "regional sync" },
    { id: "eu-us-backbone", source: "eu-1", target: "us-1", label: "inter-region backbone" },
    { id: "us-ap-backbone", source: "us-1", target: "ap-1", label: "inter-region backbone" },
    { id: "eu-ap-backbone", source: "eu-2", target: "ap-1", label: "inter-region backup" },
    { id: "user-to-eu", source: "global-user", target: "eu-2", label: "nearest entry" },
    { id: "eu-route-local", source: "eu-2", target: "eu-1", label: "local low-latency path" },
    { id: "eu-route-remote", source: "eu-2", target: "us-1", label: "remote bypass if faster" },
  ],
  steps: [
    {
      title: "1 } Regional baseline sync",
      whatHappens:
        "Each region keeps local ownership info fresh and shares summarized metadata across backbones.",
      highlightedNodes: ["eu-1", "eu-2", "us-1", "us-2", "ap-1"],
      highlightedEdges: [
        "eu-sync",
        "us-sync",
        "eu-us-backbone",
        "us-ap-backbone",
        "eu-ap-backbone",
      ],
      events: ["region heartbeat", "owner index exchange", "capacity gossip"],
    },
    {
      title: "2) User enters nearest edge",
      whatHappens:
        "Entry node starts local-route first, then checks for bypass if remote path becomes significantly faster.",
      highlightedNodes: ["global-user", "eu-2", "eu-1", "us-1"],
      highlightedEdges: ["user-to-eu", "eu-route-local", "eu-route-remote"],
      events: [
        "planStreamRoute with locality bias",
        "bypass check (20% faster)",
        "selected owner route",
      ],
    },
    {
      title: "3) Regional degradation recovery",
      whatHappens:
        "If EU owner degrades, mesh instantly pivots to US/AP candidate while keeping subscription continuity.",
      highlightedNodes: ["eu-2", "us-1", "ap-1"],
      highlightedEdges: ["eu-route-remote", "us-ap-backbone"],
      events: ["disconnectPeer allowReconnect", "candidate re-rank", "seamless failover route"],
    },
  ],
};

const previewBurstScenario: Scenario = {
  id: "preview-burst-environments",
  title: "Preview environment burst handling",
  goal: "Demonstrate rapid creation/removal of short-lived preview servers and continuous ownership discovery.",
  decentralizationNote:
    "Preview nodes join as equals, publish ownership/resources, then leave cleanly without central broker edits.",
  nodes: [
    {
      id: "gateway",
      x: 90,
      y: 180,
      label: "Gateway Node",
      subtitle: "entry for preview consumers",
    },
    { id: "pr-201", x: 380, y: 40, label: "PR-201", subtitle: "preview owner" },
    { id: "pr-202", x: 380, y: 180, label: "PR-202", subtitle: "preview owner" },
    { id: "pr-203", x: 380, y: 320, label: "PR-203", subtitle: "preview owner" },
    { id: "stable", x: 700, y: 180, label: "Stable Node", subtitle: "fallback + index retention" },
    { id: "qa-user", x: 980, y: 180, label: "QA User", subtitle: "subscribes to preview events" },
  ],
  edges: [
    { id: "gw-pr201", source: "gateway", target: "pr-201", label: "discover PR-201 owner" },
    { id: "gw-pr202", source: "gateway", target: "pr-202", label: "discover PR-202 owner" },
    { id: "gw-pr203", source: "gateway", target: "pr-203", label: "discover PR-203 owner" },
    { id: "pr-sync-stable", source: "pr-202", target: "stable", label: "index handoff" },
    { id: "qa-gw", source: "qa-user", target: "gateway", label: "subscribe by PR key" },
    { id: "qa-direct-pr", source: "qa-user", target: "pr-202", label: "direct stream when alive" },
    {
      id: "qa-stable-fallback",
      source: "qa-user",
      target: "stable",
      label: "fallback when PR expires",
    },
  ],
  steps: [
    {
      title: "1) Previews join quickly",
      whatHappens:
        "New preview nodes announce themselves and upsert stream/resource ownership indexes immediately.",
      highlightedNodes: ["gateway", "pr-201", "pr-202", "pr-203"],
      highlightedEdges: ["gw-pr201", "gw-pr202", "gw-pr203"],
      events: [
        "hello envelopes for preview nodes",
        "upsertResourceIndex(stream:pr-*)",
        "owner lookup becomes available",
      ],
    },
    {
      title: "2) QA subscribes from gateway",
      whatHappens:
        "QA user asks by preview key; gateway resolves current owner and routes directly when possible.",
      highlightedNodes: ["qa-user", "gateway", "pr-202"],
      highlightedEdges: ["qa-gw", "gw-pr202", "qa-direct-pr"],
      events: ["lookup by PR key", "plan route to preview owner", "direct event stream"],
    },
    {
      title: "3) Preview expires, fallback continues",
      whatHappens:
        "On preview teardown, ownership is removed and stable node serves remaining telemetry/history streams.",
      highlightedNodes: ["pr-202", "stable", "qa-user"],
      highlightedEdges: ["pr-sync-stable", "qa-stable-fallback"],
      events: [
        "membership_remove for preview",
        "resource index eviction",
        "fallback subscription path",
      ],
    },
  ],
};

const tenantIsolationScenario: Scenario = {
  id: "tenant-isolated-environments",
  title: "Multi-tenant environment isolation",
  goal: "Explain shared infrastructure with strict tenant/org isolation and per-tenant event ownership discovery.",
  decentralizationNote:
    "Nodes are shared but policy enforcement is local and deterministic on every server for each tenant/org scope.",
  nodes: [
    { id: "tenant-a-ui", x: 60, y: 100, label: "Tenant-A User", subtitle: "org A scope" },
    { id: "tenant-b-ui", x: 60, y: 280, label: "Tenant-B User", subtitle: "org B scope" },
    { id: "shared-1", x: 350, y: 80, label: "Shared-1", subtitle: "mesh peer (policy aware)" },
    { id: "shared-2", x: 350, y: 280, label: "Shared-2", subtitle: "mesh peer (policy aware)" },
    { id: "owner-a", x: 700, y: 80, label: "Owner-A", subtitle: "org A streams" },
    { id: "owner-b", x: 700, y: 280, label: "Owner-B", subtitle: "org B streams" },
  ],
  edges: [
    { id: "a-entry", source: "tenant-a-ui", target: "shared-1", label: "tenant A request" },
    { id: "b-entry", source: "tenant-b-ui", target: "shared-2", label: "tenant B request" },
    { id: "shared-mesh", source: "shared-1", target: "shared-2", label: "shared discovery mesh" },
    { id: "discover-a", source: "shared-1", target: "owner-a", label: "discover org A owner" },
    { id: "discover-b", source: "shared-2", target: "owner-b", label: "discover org B owner" },
    { id: "a-owner-stream", source: "tenant-a-ui", target: "owner-a", label: "tenant A stream" },
    { id: "b-owner-stream", source: "tenant-b-ui", target: "owner-b", label: "tenant B stream" },
  ],
  steps: [
    {
      title: "1) Tenant-scoped entry",
      whatHappens:
        "Both tenants enter shared mesh nodes, but auth + org checks partition visibility and candidate owners.",
      highlightedNodes: ["tenant-a-ui", "tenant-b-ui", "shared-1", "shared-2"],
      highlightedEdges: ["a-entry", "b-entry", "shared-mesh"],
      events: ["requireAuth", "organization membership check", "tenant-scoped lookup query"],
    },
    {
      title: "2) Ownership discovery stays scoped",
      whatHappens:
        "Shared nodes discover owner-A for tenant A and owner-B for tenant B without cross-tenant leakage.",
      highlightedNodes: ["shared-1", "shared-2", "owner-a", "owner-b"],
      highlightedEdges: ["discover-a", "discover-b"],
      events: ["lookupResource with org filter", "owner candidates filtered by tenant scope"],
    },
    {
      title: "3) Streaming from anywhere, still isolated",
      whatHappens:
        "Each tenant streams directly to its owner while mesh remains shared and decentralized.",
      highlightedNodes: ["tenant-a-ui", "owner-a", "tenant-b-ui", "owner-b"],
      highlightedEdges: ["a-owner-stream", "b-owner-stream"],
      events: ["direct subscription to scoped owner", "policy check on every frame path"],
    },
  ],
};

const disasterRecoveryScenario: Scenario = {
  id: "disaster-recovery-environment",
  title: "Disaster recovery (primary to DR)",
  goal: "Model DR failover where primary environment goes down and mesh discovery promotes DR owners with minimal interruption.",
  decentralizationNote:
    "Primary and DR both participate as peers ahead of time; DR activation is route/ownership switch, not central rebuild.",
  nodes: [
    { id: "user-dr", x: 50, y: 180, label: "Ops User", subtitle: "active stream consumer" },
    {
      id: "primary-a",
      x: 320,
      y: 80,
      label: "Primary-A",
      subtitle: "active owner before incident",
    },
    { id: "primary-b", x: 320, y: 280, label: "Primary-B", subtitle: "primary peer" },
    { id: "dr-a", x: 680, y: 80, label: "DR-A", subtitle: "warm standby owner" },
    { id: "dr-b", x: 680, y: 280, label: "DR-B", subtitle: "DR peer" },
    {
      id: "archive",
      x: 980,
      y: 180,
      label: "Recovery Archive",
      subtitle: "state snapshots + replay",
    },
  ],
  edges: [
    { id: "user-primary", source: "user-dr", target: "primary-a", label: "normal stream path" },
    { id: "primary-sync", source: "primary-a", target: "primary-b", label: "primary sync" },
    {
      id: "cross-replication",
      source: "primary-b",
      target: "dr-a",
      label: "replication + ownership mirror",
    },
    { id: "dr-sync", source: "dr-a", target: "dr-b", label: "dr sync" },
    { id: "dr-archive", source: "dr-a", target: "archive", label: "snapshot/replay source" },
    { id: "user-dr-route", source: "user-dr", target: "dr-a", label: "post-failover stream path" },
  ],
  steps: [
    {
      title: "1) Normal primary ownership",
      whatHappens:
        "User streams from primary owner while cross-env replication keeps DR candidates up to date.",
      highlightedNodes: ["user-dr", "primary-a", "primary-b", "dr-a"],
      highlightedEdges: ["user-primary", "primary-sync", "cross-replication"],
      events: [
        "active stream in primary",
        "continuous replication to DR",
        "DR owner metadata warm",
      ],
    },
    {
      title: "2) Primary incident detected",
      whatHappens:
        "Primary degrades/down; mesh removes unhealthy owners and promotes DR owner candidates automatically.",
      highlightedNodes: ["primary-a", "dr-a", "dr-b"],
      highlightedEdges: ["cross-replication", "dr-sync"],
      events: ["membership_suspect/remove", "resource owner re-rank", "route plan pivots to DR"],
    },
    {
      title: "3) Stream resumes from DR",
      whatHappens:
        "User continues through DR route, optionally replaying short gaps from archive-backed snapshot stream.",
      highlightedNodes: ["user-dr", "dr-a", "archive"],
      highlightedEdges: ["user-dr-route", "dr-archive"],
      events: ["direct DR subscription", "optional replay window", "steady-state DR serving"],
    },
  ],
};

const scenarios: Scenario[] = [
  firstConnectionScenario,
  tenInstanceScenario,
  eventDistributionScenario,
  envPromotionScenario,
  multiRegionProdScenario,
  previewBurstScenario,
  tenantIsolationScenario,
  disasterRecoveryScenario,
  orgScenario,
  loginScenario,
];
export { scenarios };
