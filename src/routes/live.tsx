import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, P, UL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { CodeBlock } from "@/components/doc/CodeBlock";
import { LiveQuerySim } from "@/components/interactive/LiveQuerySim";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live queries — Mesh" },
      { name: "description", content: "Reactive live queries and typed event subscriptions." },
      { property: "og:title", content: "Live queries — Mesh" },
      { property: "og:description", content: "Subscribe to query results that update automatically as the mesh changes." },
    ],
  }),
  component: () => (
    <article>
      <PageHeader eyebrow="Writes & reactivity" title="Live queries" lead="Any query becomes a reactive stream by swapping the terminal call. The runtime tracks dependencies and re-evaluates on relevant changes only." />
      <Callout variant="tldr">A live query is just <code>.live()</code> instead of <code>.list()</code>. You get back an Observable that emits the full snapshot on every change.</Callout>

      <H2 id="demo">Demo</H2>
      <P>This stream simulates a live <code>deployments</code> query — pause, resume, or change the rate.</P>
      <LiveQuerySim />

      <H2 id="api">API</H2>
      <CodeBlock lang="ts" code={`const sub = discovery
  .from(deployments)
  .where({ environment: "prod" })
  .live()
  .pipe(
    map(rows => rows.filter(r => r.status === "running")),
    distinctUntilChanged(),
  )
  .subscribe(rows => render(rows));

// later
sub.unsubscribe();`} />

      <H2 id="events">Typed event subscriptions</H2>
      <P>Beyond row-shaped streams, services can publish typed events. Consumers subscribe with full inference.</P>
      <CodeBlock lang="ts" code={`discovery.events(DeploymentMeshService.events.statusChanged)
  .where({ environment: "prod" })
  .subscribe(evt => {
    // evt: { id: string; from: Status; to: Status; at: number }
  });`} />

      <H2 id="dedup">How updates stay clean</H2>
      <UL>
        <li>The runtime tracks the entity-level change topics involved in a query.</li>
        <li>On any matching change, only affected partitions re-evaluate.</li>
        <li>Results are deduplicated by primary key before emission.</li>
        <li><code>distinctUntilChanged</code> by default at the snapshot level — no spurious re-renders.</li>
      </UL>
    </article>
  ),
});
