import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, H2, P, UL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { CodeBlock } from "@/components/doc/CodeBlock";
import { MeshTopology } from "@/components/interactive/MeshTopology";
import { ArrowRight, Network, Database, Workflow, Radio, Shield } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mesh Architecture — Overview" },
      { name: "description", content: "Overview of the Mesh distributed query and orchestration system: vision, architecture, and how the pieces fit together." },
      { property: "og:title", content: "Mesh Architecture — Overview" },
      { property: "og:description", content: "An interactive deep dive into the Mesh distributed query, peer selection, and orchestration system." },
    ],
  }),
  component: Index,
});

const HIGHLIGHTS = [
  { icon: Database, title: "Distributed query", to: "/query-builder", desc: "Drizzle-style builder over services, joins across nodes, full type inference." },
  { icon: Workflow, title: "Orchestration", to: "/orchestration", desc: "Required setup gate, root container ownership, persisted mesh URLs." },
  { icon: Network, title: "Adaptive topology", to: "/peer-selection", desc: "Latency- and load-aware peer selection with hysteresis." },
  { icon: Radio, title: "Live & reactive", to: "/live", desc: "Observable-first API; subscribe to typed events as RxJS streams." },
  { icon: Shield, title: "Sealed identity", to: "/auth", desc: "First-run portal sign-in is upgraded to a long-lived asymmetric node identity." },
];

function Index() {
  return (
    <article>
      <PageHeader
        eyebrow="Overview"
        title={<>The mesh is a <span className="gradient-text">distributed query &amp; orchestration system</span></>}
        lead="A self-hosted PaaS treats every service as a distributed relational surface. This documentation walks through the entire architecture — from the query builder API down to the bootstrap module chain that brings the runtime online."
      />

      <Callout variant="tldr">
        Each service exposes <em>queryable entities</em> instead of opaque RPCs. A consumer composes
        Drizzle-style queries that fan out across the mesh, dedupe, join, and stream results. Underneath, an
        adaptive topology keeps peer connections fresh while a strict bootstrap gate makes sure no module
        starts without identity and persisted peer URLs.
      </Callout>

      <H2 id="map">Pick your entry point</H2>
      <div className="my-5 grid gap-3 sm:grid-cols-2">
        {HIGHLIGHTS.map((h) => (
          <Link key={h.to} to={h.to} className="group rounded-xl border border-border/60 bg-surface/50 p-5 transition hover:border-indigo/50 hover:bg-surface">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo/15 text-indigo-soft">
              <h.icon className="h-4 w-4" />
            </div>
            <div className="font-display text-[15px] font-semibold">{h.title}</div>
            <p className="mt-1 text-[13px] text-muted-foreground">{h.desc}</p>
            <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-indigo-soft">
              read <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>

      <H2 id="model">The mental model</H2>
      <P>
        Older mesh designs framed nodes as endpoints exposing remote procedure calls. The model in this spec is
        different — every service is a piece of a distributed schema:
      </P>
      <UL>
        <li>A service exposes entities (deployments, logs, metrics, replicas, events, …).</li>
        <li>Entities have relations, owners, and queryable surfaces.</li>
        <li>The discovery service joins and federates across services as if they were one database.</li>
      </UL>

      <CodeBlock
        lang="ts"
        filename="example.ts"
        code={`const activeDeployments = await discovery
  .from(DeploymentMeshService.methods.deployments)
  .where({
    status: "running",
    environment: "prod",
  })
  .join(
    discovery.from(DeploymentMeshService.methods.metrics),
    (d, m) => eq(d.id, m.deploymentId),
  )
  .select(["id", "name", "status", { latestCpu: m => m.cpu }])
  .orderBy("createdAt", "desc")
  .limit(50);`}
      />

      <H2 id="topology">A live mesh, in one picture</H2>
      <P>
        Sliders below change the fleet size and latency budget. Watch the chosen peers (lit edges from the
        center node) reorganize as the topology grows or constraints tighten.
      </P>
      <MeshTopology />

      <H2 id="how">How to read this doc</H2>
      <P>
        The left sidebar groups pages by concern: foundations, the query layer, writes, the runtime, and the
        bootstrap lifecycle. Most pages contain at least one interactive widget — a calculator, a builder, or
        a stepped timeline — so the concepts are touchable, not just text.
      </P>
    </article>
  );
}
