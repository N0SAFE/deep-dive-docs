import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, P, UL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { ModuleChain } from "@/components/interactive/ModuleChain";

export const Route = createFileRoute("/bootstrap")({
  head: () => ({
    meta: [
      { title: "Bootstrap flows — Mesh" },
      { name: "description", content: "The async module chain, bootstrap memory model, and what runs in what order on every boot." },
      { property: "og:title", content: "Bootstrap flows — Mesh" },
      { property: "og:description", content: "Module dependency chain that brings the mesh runtime online deterministically on every boot." },
    ],
  }),
  component: () => (
    <article>
      <PageHeader eyebrow="Bootstrap & lifecycle" title="Bootstrap flows" lead="On every boot the runtime walks an explicit dependency chain. Each module exposes a ready promise; downstream modules wait." />

      <Callout variant="tldr">Boot is deterministic and halts loudly on the first missing dependency. There are no implicit retries that could mask a misconfigured node.</Callout>

      <H2 id="memory">Bootstrap memory model</H2>
      <UL>
        <li>Every module is a singleton owned by the bootstrap container.</li>
        <li>Modules expose <code>start()</code>, <code>ready</code> (Promise), <code>shutdown()</code>.</li>
        <li>The container builds a topological order from declared dependencies.</li>
        <li>Failures bubble up; the container records which module failed, then triggers reverse-order shutdown.</li>
      </UL>

      <H2 id="chain">Try the chain</H2>
      <P>Hit <em>boot</em> to walk the chain. Each module turns green when its dependencies report <code>ready</code>.</P>
      <ModuleChain />

      <H2 id="responsibilities">Module responsibilities</H2>
      <UL>
        <li><strong>config-loader</strong> — env, sealed secrets, feature flags.</li>
        <li><strong>local-db</strong> — opens the local store; runs pending migrations.</li>
        <li><strong>node-identity</strong> — loads the keypair; halts if missing on second boot.</li>
        <li><strong>mesh-client</strong> — reads persisted peer URLs and reconnects.</li>
        <li><strong>discovery-svc</strong> — subscribes to fleet topics, emits a live registry.</li>
        <li><strong>scheduler / router</strong> — domain modules that depend on discovery being live.</li>
        <li><strong>api-surface</strong> — exposed last, only after the system can serve requests.</li>
      </UL>
    </article>
  ),
});
