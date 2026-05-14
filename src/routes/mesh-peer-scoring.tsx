import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, H3, P, UL, OL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { Math as TeX } from "@/components/doc/Math";
import { MeshPeerSelectionVisual } from "@/components/interactive/MeshPeerSelectionVisual";

export const Route = createFileRoute("/mesh-peer-scoring")({
  head: () => ({
    meta: [
      { title: "Mesh Peer Scoring — Mesh" },
      { name: "description", content: "How the mesh scores candidates and selects peers based on latency, load, and capacity." },
      { property: "og:title", content: "Mesh Peer Scoring — Mesh" },
      { property: "og:description", content: "Peer selection algorithm: scoring, weighting, and adaptive peer degree computation." },
    ],
  }),
  component: () => (
    <article>
      <PageHeader
        eyebrow="Runtime"
        title="Mesh Peer Scoring"
        lead="The mesh prefers low-latency, low-load, high-capacity peers. Adjust weights, latency budget, and target peer count to see how selection changes."
      />

      <Callout variant="tldr">
        Every candidate gets a score. Pick the top <em>k</em> peers. Re-evaluate periodically. Avoid thrashing with hysteresis.
      </Callout>

      <H2 id="goals">Goals</H2>
      <UL>
        <li>Prefer lowest-latency peers under load constraints.</li>
        <li>Adapt peer degree to fleet size and node capacity.</li>
        <li>Re-evaluate peers periodically and on change triggers.</li>
        <li>Use authenticated mesh pings (internal ORPC) and avoid public contracts.</li>
      </UL>

      <H2 id="definitions">Key definitions</H2>
      <UL>
        <li>
          <strong>Candidate:</strong> any active mesh node with valid auth handshake.
        </li>
        <li>
          <strong>Peer:</strong> a chosen node with which a persistent mesh stream/bridge is maintained.
        </li>
        <li>
          <strong>Latency budget:</strong> target RTT threshold (configurable, default 100ms).
        </li>
        <li>
          <strong>Capacity index:</strong> normalized node capacity score (CPU/RAM class and headroom).
        </li>
      </UL>

      <H2 id="interactive">Interactive scoring</H2>
      <P>Adjust the weights and latency budget below to see how peer selection changes:</P>
      <MeshPeerSelectionVisual />

      <H2 id="algorithm">Scoring algorithm</H2>

      <H3>Phase 1: Discovery & authenticated ping</H3>
      <OL>
        <li>Query fleet registry for active nodes.</li>
        <li>For each candidate, perform authenticated ORPC mesh ping:
          <UL>
            <li>Measure RTT and jitter (p50, p95, p99).</li>
            <li>Capture load metrics (CPU, memory pressure, queue backlog, stream count).</li>
          </UL>
        </li>
        <li>Discard candidates that fail authentication or exceed failure budget.</li>
      </OL>

      <H3>Phase 2: Scoring</H3>
      <P>Normalize metrics to [0, 1] where lower is better (except capacity where higher is better).</P>

      <P>Let:</P>
      <UL>
        <li>L = normalized latency score</li>
        <li>J = normalized jitter score</li>
        <li>Q = normalized queue backlog</li>
        <li>C = normalized capacity index (higher is better)</li>
      </UL>

      <P>Score function (lower is better):</P>
      <TeX block tex={`Score = w_L \\cdot L + w_J \\cdot J + w_Q \\cdot Q + w_C \\cdot (1 - C)`} />

      <P>Weights are configurable and default to latency-first behavior:</P>
      <TeX block tex={`\\sum w = 1, \\quad w_L \\ge 0.35`} />

      <H3>Phase 3: Peer degree computation</H3>
      <P>Compute target peer count k based on fleet size N, capacity index C, and median latency L_tilde:</P>

      <TeX block tex={`K_{base} = \\lceil a + b \\cdot \\log_2(N) \\rceil`} />

      <TeX block tex={`K_{capacity} = \\lceil K_{base} \\cdot (0.6 + 0.4C) \\rceil`} />

      <TeX block tex={`K_{latency} = \\lceil K_{base} \\cdot (1 - \\tilde{L} / L_{budget}) \\rceil`} />

      <TeX block tex={`k = \\text{clamp}(minPeers, maxPeers, \\max(K_{base}, K_{capacity}, K_{latency}))`} />

      <UL>
        <li>a, b are config knobs (default a=1, b=2).</li>
        <li>L_budget is a config latency budget (default 100ms).</li>
        <li>clamp enforces configured bounds (typically minPeers=2, maxPeers=8).</li>
      </UL>

      <H3>Phase 4: Peer selection</H3>
      <OL>
        <li>Sort candidates by ascending Score.</li>
        <li>Select first k as peers.</li>
        <li>Apply hysteresis to avoid flapping:
          <UL>
            <li>Keep existing peers unless a candidate exceeds improvement threshold δ.</li>
            <li>Replace at most r peers per cycle (configurable).</li>
          </UL>
        </li>
      </OL>

      <H3>Phase 5: Rebalancing cadence</H3>
      <P>Re-evaluate peers under either:</P>
      <UL>
        <li>
          <strong>Adaptive timer (default):</strong>
          <UL>
            <li>Shorter interval when jitter or load volatility exceeds threshold.</li>
            <li>Longer interval when system is stable.</li>
          </UL>
        </li>
        <li>
          <strong>Change triggers:</strong>
          <UL>
            <li>Node joins/leaves</li>
            <li>Latency delta &gt; θ_latency</li>
            <li>Load delta &gt; θ_load</li>
          </UL>
        </li>
      </UL>

      <H3>Phase 6: Fleet health checks</H3>
      <P>At each re-evaluation, issue a low-overhead fleet-wide ping sweep to refresh RTT baselines and adjust Score inputs.</P>

      <H2 id="tuning">Tuning the score</H2>

      <H3>Latency-first (default)</H3>
      <TeX block tex={`w_L = 0.45, w_J = 0.10, w_Q = 0.15, w_C = 0.30`} />
      <P>Use when low-latency response times matter most. Example: real-time dashboards.</P>

      <H3>Load-balanced</H3>
      <TeX block tex={`w_L = 0.25, w_J = 0.15, w_Q = 0.30, w_C = 0.30`} />
      <P>Use when even distribution across nodes is important. Example: batch processing.</P>

      <H3>Capacity-aware</H3>
      <TeX block tex={`w_L = 0.30, w_J = 0.10, w_Q = 0.10, w_C = 0.50`} />
      <P>Use when nodes have heterogeneous capacities. Strongly prefers high-capacity nodes.</P>

      <H2 id="best-practices">Best practices</H2>

      <UL>
        <li>
          <strong>Start with defaults.</strong> Latency-first weights work for most workloads.
        </li>
        <li>
          <strong>Measure first.</strong> Know your fleet's latency distribution before tuning.
        </li>
        <li>
          <strong>Adjust gradually.</strong> Change weights by 0.05 at a time and measure impact.
        </li>
        <li>
          <strong>Monitor churn.</strong> If peers change too often, increase hysteresis window or lower delta thresholds.
        </li>
        <li>
          <strong>Test on single-node.</strong> Ensure algorithm works before scaling to multi-node.
        </li>
      </UL>

      <Callout variant="warn">
        The scoring algorithm is <strong>not yet implemented</strong>. This page documents the target design.
      </Callout>
    </article>
  ),
});
