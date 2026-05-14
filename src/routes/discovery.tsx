import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, P, UL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { CodeBlock } from "@/components/doc/CodeBlock";
import { MeshTopology } from "@/components/interactive/MeshTopology";

export const Route = createFileRoute("/discovery")({
  head: () => ({
    meta: [
      { title: "Discovery service — Mesh" },
      { name: "description", content: "How the discovery service routes queries, derives topics, and federates services." },
      { property: "og:title", content: "Discovery service — Mesh" },
      { property: "og:description", content: "The federation layer that turns entities into a single queryable surface." },
    ],
  }),
  component: () => (
    <article>
      <PageHeader eyebrow="Runtime" title="Discovery service" lead="Discovery is the entry point for every query and event subscription. It owns the entity registry, derives transport topics, and federates calls across the mesh." />

      <H2 id="topology">Live mesh map</H2>
      <P>The same topology widget — drop-in here because peer selection is what discovery uses to pick fanout targets.</P>
      <MeshTopology defaultSize={20} />

      <H2 id="topics">Internal topic derivation</H2>
      <UL>
        <li><code>{`<service>.<entity>.list`}</code> — fanout read</li>
        <li><code>{`<service>.<entity>.changes`}</code> — change stream for live queries</li>
        <li><code>{`<service>.<entity>.mutate.<op>`}</code> — typed mutation routes</li>
        <li><code>{`<service>.<event>`}</code> — typed event channel</li>
      </UL>
      <Callout variant="info">Callers never see these strings. Discovery derives and validates them from the entity definitions at registration time.</Callout>

      <H2 id="registry">Fleet registry</H2>
      <P>Discovery maintains a live registry of:</P>
      <UL>
        <li>Authenticated nodes and their service catalogs</li>
        <li>Entity owners (for owner-only mutation routing)</li>
        <li>Per-entity version vectors for replica freshness</li>
        <li>Per-peer health: latency p50/p95/p99, queue, capacity</li>
      </UL>

      <H2 id="lookup">Routing a query</H2>
      <CodeBlock lang="ts" code={`// pseudo:
function routeQuery(plan) {
  const peers = peerSelector.pickForEntity(plan.entity);
  const partials = peers.map(p =>
    p.send(deriveTopic(plan.entity, "list"), plan.scanArgs)
  );
  return mergeAndDedup(partials, plan.dedupKey);
}`} />
    </article>
  ),
});
