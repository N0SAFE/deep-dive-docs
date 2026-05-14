import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, H3, P } from "@/components/doc/Prose";
import { CodeBlock } from "@/components/doc/CodeBlock";

export const Route = createFileRoute("/examples")({
  head: () => ({
    meta: [
      { title: "Examples — Mesh" },
      { name: "description", content: "End-to-end mesh examples: filtered queries, joins with subqueries, deep nested graphs, and full v3 capabilities combined." },
      { property: "og:title", content: "Examples — Mesh" },
      { property: "og:description", content: "Concrete end-to-end examples of the mesh query and orchestration system." },
    ],
  }),
  component: () => (
    <article>
      <PageHeader eyebrow="Reference" title="End-to-end examples" lead="Four worked examples taken from the spec, ordered by complexity." />

      <H2 id="ex1">1 — Basic query with filter</H2>
      <CodeBlock lang="ts" code={`const running = await discovery
  .from(deployments)
  .where({ status: "running", environment: "prod" })
  .orderBy("createdAt", "desc")
  .limit(50)
  .list();`} />

      <H2 id="ex2">2 — Join with filtered subquery</H2>
      <CodeBlock lang="ts" code={`const failingIds = discovery
  .from(deployments)
  .where({ status: "failing" })
  .select(["id"]);

const recent = await discovery
  .from(logs)
  .where(inArray(logs.deploymentId, failingIds))
  .orderBy("ts", "desc")
  .limit(200)
  .list();`} />

      <H2 id="ex3">3 — Deep nested join graph</H2>
      <CodeBlock lang="ts" code={`const tree = await discovery
  .from(deployments)
  .with("replicas", r => r
    .with("metrics", m => m.orderBy("ts", "desc").limit(1))
    .with("events", e => e.where({ type: "scaled" }))
  )
  .with("routing")
  .where({ environment: "prod" })
  .list();`} />

      <H2 id="ex4">4 — Full v3 capabilities combined</H2>
      <CodeBlock lang="ts" code={`const live = discovery
  .from(deployments)
  .with("metrics")
  .where(and(eq(d.environment, "prod"), gt(d.createdAt, sinceMonday)))
  .aggregate({
    byStatus: groupBy("status", { count: count(), avgCpu: avg(m => m.cpu) }),
  })
  .live()
  .pipe(distinctUntilChanged())
  .subscribe(snapshot => render(snapshot));`} />
      <H3>What just happened</H3>
      <P>One query touches three entities, runs across every peer that owns any of them, performs a grouped aggregation with a mergeable function, and stays live — re-evaluating only when relevant change topics fire. No transport code, no manual dedup, no per-peer joins.</P>
    </article>
  ),
});
