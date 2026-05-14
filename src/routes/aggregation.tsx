import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, P, UL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { CodeBlock } from "@/components/doc/CodeBlock";

export const Route = createFileRoute("/aggregation")({
  head: () => ({
    meta: [
      { title: "Aggregation — Mesh" },
      { name: "description", content: "Distributed aggregation engine: partial aggregates per peer, merged centrally." },
      { property: "og:title", content: "Aggregation — Mesh" },
      { property: "og:description", content: "How count, sum, avg, min, max, and grouped aggregations execute across the mesh." },
    ],
  }),
  component: () => (
    <article>
      <PageHeader eyebrow="Query layer" title="Distributed aggregation" lead="Aggregations execute in two stages: a partial aggregate per peer, then a deterministic merge at the coordinator." />
      <Callout variant="tldr">Each peer returns a small partial result. The coordinator combines partials algebraically — never round-tripping raw rows.</Callout>
      <H2 id="api">API</H2>
      <CodeBlock lang="ts" code={`discovery.from(deployments)
  .where({ environment: "prod" })
  .aggregate({
    total: count(),
    running: count(d => eq(d.status, "running")),
    avgUptime: avg(d => d.uptimeSeconds),
  });`} />
      <H2 id="grouped">Grouped aggregation</H2>
      <CodeBlock lang="ts" code={`discovery.from(metrics)
  .groupBy("deploymentId")
  .aggregate({
    p50Cpu: percentile(0.5, m => m.cpu),
    p99Cpu: percentile(0.99, m => m.cpu),
    samples: count(),
  });`} />
      <H2 id="mergeable">What's mergeable</H2>
      <UL>
        <li><code>count, sum, min, max, avg</code> — exact, with simple algebraic merge.</li>
        <li>Percentiles via t-digest — approximate but mergeable.</li>
        <li><code>countDistinct</code> via HyperLogLog — approximate, configurable error.</li>
        <li>Custom: any monoid (identity + associative combine).</li>
      </UL>
      <Callout variant="warn">Non-mergeable aggregations (median over raw rows) require pulling rows to the coordinator — the planner will warn in <code>.explain()</code>.</Callout>
    </article>
  ),
});
