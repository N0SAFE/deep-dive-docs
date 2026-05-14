import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, H3, P, UL, OL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { CodeBlock } from "@/components/doc/CodeBlock";

export const Route = createFileRoute("/concepts")({
  head: () => ({
    meta: [
      { title: "Core concepts — Mesh" },
      { name: "description", content: "The mental model shift behind the mesh: distributed entities instead of RPCs, and the design principles and invariants that follow." },
      { property: "og:title", content: "Core concepts — Mesh" },
      { property: "og:description", content: "Concept shift, design principles, and invariants of the Mesh distributed query system." },
    ],
  }),
  component: Concepts,
});

function Concepts() {
  return (
    <article>
      <PageHeader
        eyebrow="Foundations"
        title="Core concepts"
        lead="Before the API surface makes sense, the mental model needs to shift. The mesh isn't a transport — it's a federated database whose tables happen to live on different nodes."
      />

      <H2 id="shift">The concept shift</H2>
      <P>The previous model was:</P>
      <Callout variant="warn" title="Old model">
        “A service exposes a few remote procedure calls. Consumers call them by name and stitch results
        together client-side.”
      </Callout>
      <P>The new model is:</P>
      <Callout variant="tldr" title="New model">
        “A service exposes a <strong>distributed relational surface</strong> composed of queryable entities.
        Consumers think in entities, queries, joins, projections — not topics, requests, or correlation
        envelopes.”
      </Callout>

      <P>
        Every mesh service behaves conceptually like a distributed database schema. A deployment service can
        expose deployments, logs, replicas, metrics, health snapshots, routing tables, revisions, and events
        — all queryable through the same federated surface.
      </P>

      <H2 id="problems">Problems with the previous model</H2>
      <UL>
        <li>Boilerplate per RPC: contracts, topics, envelopes, retry, dedup — duplicated everywhere.</li>
        <li>No relational composition: joins across services were hand-written merges.</li>
        <li>Type inference died at the transport boundary; consumers re-declared shapes.</li>
        <li>Ad-hoc dedup let the same row arrive multiple times from different peers.</li>
        <li>Pagination, ordering, and aggregation were each callers' problem.</li>
      </UL>

      <H2 id="principles">Design principles</H2>
      <OL>
        <li><strong>Zero-boilerplate, fully inferred.</strong> Define an entity once; everything downstream knows its shape.</li>
        <li><strong>Drizzle-style builder.</strong> Familiar API: <code>from / where / select / join / orderBy / limit</code>.</li>
        <li><strong>Distributed-by-default.</strong> Queries fan out to peers without the caller asking for it.</li>
        <li><strong>Strong type inference.</strong> Joins, subqueries, projections all keep their shape end-to-end.</li>
        <li><strong>Observable-first.</strong> Every query exposes a stream you can pipe with RxJS operators.</li>
        <li><strong>Internal topics.</strong> Transport contracts are derived from entity definitions, never hand-written.</li>
        <li><strong>Deterministic dedup.</strong> Results coming from multiple nodes are merged by primary key.</li>
        <li><strong>Authenticated mesh control.</strong> All control-plane calls require asymmetric node identity.</li>
      </OL>

      <H2 id="invariants">System invariants</H2>
      <P>These are non-negotiable rules the system upholds:</P>
      <UL>
        <li>An entity's primary key uniquely identifies it across all peers.</li>
        <li>A service registers entities, not topics — topics are derived.</li>
        <li>Every query is observable; sync results are the “first emission, then complete” case.</li>
        <li>No mutation can run before the setup gate completes.</li>
        <li>No module starts before its declared dependencies report <code>ready</code>.</li>
        <li>Mesh peer URLs are persisted in local DB; restarts never re-prompt the user.</li>
        <li>Node identity, once sealed, is the sole authority for mesh control calls.</li>
        <li>Uninstalling the root container terminates every child container automatically.</li>
      </UL>

      <H2 id="example">Concretely</H2>
      <P>
        Both snippets below describe the same intent. The new one is shorter, type-safe across the join, and
        runs distributed automatically.
      </P>

      <H3>Old way</H3>
      <CodeBlock
        lang="ts"
        code={`const deployments = await meshClient.call("deployment.list", { status: "running" });
const ids = deployments.map(d => d.id);
const metrics = await meshClient.call("deployment.metrics", { deploymentIds: ids });
const merged = deployments.map(d => ({
  ...d,
  metrics: metrics.filter(m => m.deploymentId === d.id),
}));`}
      />

      <H3>New way</H3>
      <CodeBlock
        lang="ts"
        code={`const merged = await discovery
  .from(DeploymentMeshService.methods.deployments)
  .where({ status: "running" })
  .join(discovery.from(DeploymentMeshService.methods.metrics),
        (d, m) => eq(d.id, m.deploymentId))
  .select((d, m) => ({ ...d, metrics: collect(m) }));`}
      />
    </article>
  );
}
