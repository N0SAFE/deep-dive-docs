import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, P, UL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { CodeBlock } from "@/components/doc/CodeBlock";
import { QueryPlayground } from "@/components/interactive/QueryPlayground";

export const Route = createFileRoute("/query-builder")({
  head: () => ({
    meta: [
      { title: "Query builder — Mesh" },
      { name: "description", content: "The Drizzle-style mesh query builder: from, where, select, orderBy, pagination, and subqueries." },
      { property: "og:title", content: "Query builder — Mesh" },
      { property: "og:description", content: "Compose distributed queries with from / where / select / order — fully type-safe across joins and subqueries." },
    ],
  }),
  component: Builder,
});

function Builder() {
  return (
    <article>
      <PageHeader
        eyebrow="Query layer"
        title="Query builder"
        lead="A familiar Drizzle-style API that fans out across the mesh and merges results into a single typed stream."
      />

      <Callout variant="tldr">
        Every query starts with <code>discovery.from(entity)</code> and ends with a terminal call (<code>.list()</code>,
        <code>.first()</code>, <code>.live()</code>, <code>.aggregate()</code>). Everything in between is composable
        and chainable.
      </Callout>

      <H2 id="playground">Try it</H2>
      <P>Toggle the clauses below — the generated TypeScript and the execution plan update live.</P>
      <QueryPlayground />

      <H2 id="from">from(entity)</H2>
      <P>
        Picks the entity to query. The builder remembers its shape so every subsequent clause is type-aware.
        Aliases are supported via <code>.as("alias")</code>.
      </P>
      <CodeBlock lang="ts" code={`discovery.from(deployments).as("d")`} />

      <H2 id="where">where(predicate)</H2>
      <P>
        Predicates can be a partial of the entity shape (equality match) or an expression built with
        <code> eq</code>, <code>and</code>, <code>or</code>, <code>not</code>, <code>gt</code>, <code>lt</code>,
        <code>inArray</code>, <code>like</code>, etc.
      </P>
      <CodeBlock lang="ts" code={`.where({ status: "running", environment: "prod" })
.where(and(eq(d.status, "running"), gt(d.createdAt, lastWeek)))`} />

      <Callout variant="tip">
        Predicates are <strong>pushed down</strong> to each peer's local store before merging — so a peer
        with millions of rows only sends back the matches.
      </Callout>

      <H2 id="select">select(...)</H2>
      <P>Three forms:</P>
      <UL>
        <li><code>.select(["id", "status"])</code> — pick columns.</li>
        <li><code>.select(d ={">"} ({"{"} id: d.id, isLive: eq(d.status, "running") {"}"}))</code> — projection function.</li>
        <li><code>.select("*")</code> — full row (default if omitted).</li>
      </UL>

      <H2 id="order">orderBy &amp; pagination</H2>
      <CodeBlock lang="ts" code={`.orderBy("createdAt", "desc")
.limit(50)
.offset(50)         // or
.cursor({ after: lastId })`} />
      <P>
        Cursor pagination is preferred for live data. The cursor is the primary key of the last row of the
        previous page, so duplicates can't slip in if a row is created between pages.
      </P>

      <H2 id="subqueries">Subqueries</H2>
      <P>
        Any builder chain can be passed where a value is expected. The runtime executes it lazily and inlines
        the result.
      </P>
      <CodeBlock lang="ts" code={`const failingIds = discovery
  .from(deployments)
  .where({ status: "failing" })
  .select(["id"]);

const recentLogs = discovery
  .from(logs)
  .where(inArray(logs.deploymentId, failingIds))
  .orderBy("ts", "desc")
  .limit(200);`} />

      <H2 id="terminals">Terminal calls</H2>
      <UL>
        <li><code>.list()</code> → resolves to <code>T[]</code></li>
        <li><code>.first()</code> → resolves to <code>T | null</code></li>
        <li><code>.live()</code> → returns an Observable that emits the full result set on every relevant change</li>
        <li><code>.aggregate(...)</code> → distributed aggregation (see <a href="/aggregation" className="text-indigo-soft underline">Aggregation</a>)</li>
        <li><code>.explain()</code> → returns the plan tree without executing</li>
      </UL>
    </article>
  );
}
