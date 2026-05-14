import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, H3, P, UL, OL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { Math as TeX } from "@/components/doc/Math";
import { PeerScoreCalculator } from "@/components/interactive/PeerScoreCalculator";

export const Route = createFileRoute("/peer-selection")({
  head: () => ({
    meta: [
      { title: "Peer selection — Mesh" },
      { name: "description", content: "Adaptive, latency- and load-aware peer selection algorithm with hysteresis." },
      { property: "og:title", content: "Peer selection — Mesh" },
      { property: "og:description", content: "How the mesh chooses peers using a weighted score function and adapts in real time." },
    ],
  }),
  component: () => (
    <article>
      <PageHeader eyebrow="Runtime" title="Peer selection" lead="The mesh prefers low-latency, low-load, high-capacity peers — and rebalances as conditions change. The algorithm runs continuously, with hysteresis to prevent thrash." />
      <Callout variant="tldr">Score every authenticated candidate, pick the top <em>k</em>, where <em>k</em> grows with fleet size and capacity. Re-evaluate periodically and on change triggers.</Callout>

      <H2 id="phase1">Phase 1 — Discovery &amp; authenticated ping</H2>
      <OL>
        <li>Query the fleet registry for active nodes.</li>
        <li>For each candidate, send an authenticated ORPC mesh ping; measure RTT, jitter (p50, p95, p99), and load metrics.</li>
        <li>Discard candidates that fail authentication or exceed the failure budget.</li>
      </OL>

      <H2 id="phase2">Phase 2 — Scoring</H2>
      <P>Normalize each metric to <TeX tex="[0,1]" /> where lower is better (capacity inverted). The score is a weighted sum:</P>
      <TeX block tex={`Score = w_L L + w_J J + w_Q Q + w_S S + w_M M + w_F F + w_C(1 - C)`} />
      <P>Weights are configurable; defaults are latency-first with <TeX tex={`\\sum w = 1,\\ w_L \\ge 0.35`} />.</P>

      <H2 id="phase3">Phase 3 — Peer degree</H2>
      <P>Target peer count <TeX tex="k" /> grows with fleet size, capped by capacity and latency budget:</P>
      <TeX block tex={`K_{base} = \\lceil a + b\\,\\log_2(N) \\rceil`} />
      <TeX block tex={`K_{cap} = \\lceil K_{base}(0.6 + 0.4\\,C) \\rceil`} />
      <TeX block tex={`K_{lat} = \\lceil K_{base}(1 - \\tilde{L}/L_{budget}) \\rceil`} />
      <TeX block tex={`k = \\mathrm{clamp}(\\text{minPeers},\\ \\text{maxPeers},\\ \\max(K_{base}, K_{cap}, K_{lat}))`} />

      <H2 id="calc">Try the scoring</H2>
      <P>Slide the weights, the latency budget, or the fleet size <em>N</em>. The ranking and chosen peer set update live.</P>
      <PeerScoreCalculator />

      <H2 id="phase4">Phase 4 — Hysteresis</H2>
      <UL>
        <li>A candidate must beat an incumbent peer's score by a margin <TeX tex="\delta" /> to displace it.</li>
        <li>Demotions require the score to remain worse for a window <TeX tex="W" /> (typically 30s) to avoid flapping.</li>
        <li>Network-event triggers (peer drop, partition, role change) bypass <TeX tex="W" /> and force re-evaluation.</li>
      </UL>

      <H3>Re-evaluation cadence</H3>
      <UL>
        <li>Periodic — every <TeX tex="T" /> seconds (default 15s) at low priority.</li>
        <li>Event-driven — peer drop, fleet membership change, weight policy update.</li>
        <li>Backoff when the topology is stable to reduce churn under steady state.</li>
      </UL>
    </article>
  ),
});
