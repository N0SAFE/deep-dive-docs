import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, P, UL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { CodeBlock } from "@/components/doc/CodeBlock";

export const Route = createFileRoute("/api")({
  head: () => ({
    meta: [
      { title: "Observable API — Mesh" },
      { name: "description", content: "Why every mesh call returns an Observable and how to consume it with RxJS operators." },
      { property: "og:title", content: "Observable API — Mesh" },
      { property: "og:description", content: "The mesh's RxJS-first surface — consume queries, mutations, and events with the same operators." },
    ],
  }),
  component: () => (
    <article>
      <PageHeader eyebrow="Bootstrap & lifecycle" title="Observable-first API" lead="Every mesh interaction is an Observable. Sync requests are just streams that emit once and complete." />

      <Callout variant="tldr">One mental model for queries, live queries, and events. <code>await firstValueFrom(...)</code> when you want a one-shot.</Callout>

      <H2 id="why">Why Observables</H2>
      <UL>
        <li>The transport is inherently asynchronous and partial-result-friendly.</li>
        <li>Operators (map, filter, scan, retry, debounce) compose over both reads and event streams.</li>
        <li>Cleanup is unified: unsubscribing tears down the underlying mesh subscription.</li>
        <li>Streaming aggregations and incremental joins map naturally to <code>scan</code>.</li>
      </UL>

      <H2 id="patterns">Common patterns</H2>
      <CodeBlock lang="ts" code={`// One-shot
const rows = await firstValueFrom(query.list$());

// Live with retry on transient errors
query.live().pipe(
  retry({ count: 3, delay: 500 }),
  catchError(err => of([])),
).subscribe(setRows);

// Event-driven side effect
events.statusChanged
  .pipe(filter(e => e.to === "failing"))
  .subscribe(triggerOncall);`} />

      <H2 id="cancellation">Cancellation</H2>
      <P>Subscribing returns a <code>Subscription</code>; calling <code>unsubscribe()</code> cancels in-flight work on every peer participating in the query.</P>
    </article>
  ),
});
