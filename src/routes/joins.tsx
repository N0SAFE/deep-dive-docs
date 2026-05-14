import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, H3, P, UL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { CodeBlock } from "@/components/doc/CodeBlock";

export const Route = createFileRoute("/joins")({
  head: () => ({
    meta: [
      { title: "Joins — Mesh" },
      { name: "description", content: "Join entities across the mesh: basic joins, auto-joins via relations, nested joins, and how the type system threads through." },
      { property: "og:title", content: "Joins — Mesh" },
      { property: "og:description", content: "How the mesh joins entities across services with full type inference." },
    ],
  }),
  component: Joins,
});

function Joins() {
  return (
    <article>
      <PageHeader
        eyebrow="Query layer"
        title="Joins"
        lead="Joining entities across services is what makes the mesh feel like one database. Three forms cover everything from explicit conditions to deep typed graphs."
      />

      <Callout variant="tldr">
        Use <code>.join</code> for an explicit condition, <code>.with</code> when a <code>meshRelation</code>{" "}
        already exists, and nested chains for graph queries. Type inference threads through every level.
      </Callout>

      <H2 id="basic">Basic join</H2>
      <CodeBlock
        lang="ts"
        code={`discovery
  .from(deployments).as("d")
  .join(
    discovery.from(metrics).as("m"),
    (d, m) => eq(d.id, m.deploymentId),
    { type: "left" } // "inner" | "left" | "right" | "full"
  )
  .select((d, m) => ({
    id: d.id,
    name: d.name,
    cpu: m.cpu,
  }));`}
      />

      <H2 id="auto">Auto-join via meshRelation</H2>
      <P>
        Once a relation is declared, the builder can resolve the join for you. The alias declared on the
        relation becomes available on the result.
      </P>
      <CodeBlock
        lang="ts"
        code={`discovery
  .from(deployments)
  .with("metrics")        // uses meshRelation(deployments → metrics)
  .with("replicas")
  .where({ status: "running" });

// result type:
// { id: string; name: string; ...; metrics: Metric[]; replicas: Replica[] }`}
      />

      <H2 id="nested">Nested joins</H2>
      <P>
        Joins can themselves be queries. The full graph still resolves with one round of fan-out per
        independent branch.
      </P>
      <CodeBlock
        lang="ts"
        code={`discovery
  .from(deployments)
  .join(
    discovery
      .from(replicas)
      .join(
        discovery.from(metrics),
        (r, m) => eq(r.id, m.replicaId),
      )
      .select((r, m) => ({ ...r, latestMetric: m })),
    (d, r) => eq(d.id, r.deploymentId),
  );`}
      />

      <H2 id="inference">Type inference</H2>
      <P>
        Each call narrows the inferred result type. By the time a terminal call runs, the result type is
        exact — including:
      </P>
      <UL>
        <li>Aliases applied via <code>.as()</code></li>
        <li>Cardinality from <code>meshRelation</code> (1:N collapses into arrays, 1:1 stays scalar)</li>
        <li>Outer join nullability (left side nullable on right joins, etc.)</li>
        <li>Projection narrowing in <code>.select</code></li>
      </UL>

      <H3>Cross-service joins</H3>
      <P>
        Nothing changes syntactically when the join crosses a service boundary. The discovery service
        coordinates the fan-out and merge so callers never write transport code.
      </P>
      <CodeBlock
        lang="ts"
        code={`discovery
  .from(BillingMeshService.entities.invoices)
  .join(
    discovery.from(DeploymentMeshService.entities.deployments),
    (i, d) => eq(i.deploymentId, d.id),
  );`}
      />

      <Callout variant="warn" title="Performance hint">
        Joins across two huge entities benefit from a <code>where</code> on the smaller side. The planner
        will use the bound side as the driver and only request matching keys from the larger one.
      </Callout>
    </article>
  );
}
