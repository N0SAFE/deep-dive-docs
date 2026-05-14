import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, P, UL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { CodeBlock } from "@/components/doc/CodeBlock";

export const Route = createFileRoute("/execution")({
  head: () => ({
    meta: [
      { title: "Execution engine — Mesh" },
      { name: "description", content: "How the planner, deduper, middleware, cache, and EXPLAIN work together." },
      { property: "og:title", content: "Execution engine — Mesh" },
      { property: "og:description", content: "Inside the mesh execution engine: planning, dedup, middleware, caching, EXPLAIN." },
    ],
  }),
  component: () => (
    <article>
      <PageHeader eyebrow="Runtime" title="Execution engine" lead="Builders produce a plan tree. The engine executes the tree across peers, dedupes the merged stream, applies middleware, and caches when safe." />

      <H2 id="plan">Plan tree</H2>
      <P>Every query compiles to a tree of stages: <code>scan</code>, <code>filter</code>, <code>join</code>, <code>aggregate</code>, <code>project</code>, <code>order</code>, <code>limit</code>, <code>dedup</code>, <code>merge</code>.</P>
      <CodeBlock lang="ts" code={`Plan {
  Limit(50)
    Order(createdAt desc)
      Dedup(byPrimaryKey: id)
        Merge
          Fanout(peers = 6)
            Project(["id","name","status"])
              Filter({ status: "running" })
                Scan(deployments)
}`} />

      <H2 id="dedup">Distributed deduplication</H2>
      <UL>
        <li>Every entity declares a <code>primaryKey</code>.</li>
        <li>Merged streams pass through a Bloom-filter-backed dedup window.</li>
        <li>Window size scales with <code>limit</code> + ordering — never unbounded.</li>
        <li>Equal primary keys with conflicting versions resolve by <code>updatedAt</code> high-watermark.</li>
      </UL>

      <H2 id="middleware">Middleware pipeline</H2>
      <CodeBlock lang="ts" code={`discovery.use(authzMiddleware());
discovery.use(tracingMiddleware());
discovery.use(quotaMiddleware({ perOrgRps: 1000 }));`} />
      <P>Middleware sees every query before fanout and every response after merge. Use it for authz, tracing, request metering, and audit.</P>

      <H2 id="cache">Query caching</H2>
      <UL>
        <li>Cache key = canonical plan hash + caller scope.</li>
        <li>Invalidation is event-driven via the change-stream topics the plan depends on.</li>
        <li>TTL is a fallback safety net only; correctness comes from invalidation.</li>
      </UL>

      <H2 id="explain">EXPLAIN</H2>
      <CodeBlock lang="ts" code={`const plan = await query.explain();
console.log(plan.toAscii());
//
// Limit(50)
// └─ Order(createdAt desc)
//    └─ Dedup(id)
//       └─ Merge
//          └─ Fanout (6 peers · 12 ms p50)
//             └─ Filter({ status: "running" })   pushdown=yes
//                └─ Scan(deployments)             rows≈ 2.4k`} />
      <Callout variant="tip">EXPLAIN never executes the query. It also flags non-mergeable aggregations and missing indexes.</Callout>
    </article>
  ),
});
