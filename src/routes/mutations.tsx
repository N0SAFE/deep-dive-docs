import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, H3, P, UL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { CodeBlock } from "@/components/doc/CodeBlock";
import { MutationStrategy } from "@/components/interactive/MutationStrategy";
import { SagaTimeline } from "@/components/interactive/SagaTimeline";

export const Route = createFileRoute("/mutations")({
  head: () => ({
    meta: [
      { title: "Mutations — Mesh" },
      { name: "description", content: "Mutation builder, strategies (owner / quorum / broadcast), optimistic updates, and distributed sagas." },
      { property: "og:title", content: "Mutations — Mesh" },
      { property: "og:description", content: "How writes propagate across the mesh — including optimistic updates and saga compensation." },
    ],
  }),
  component: () => (
    <article>
      <PageHeader eyebrow="Writes & reactivity" title="Mutations" lead="Writes are typed, routed, and acknowledged according to a strategy. Multi-step workflows use a saga coordinator with compensations." />

      <H2 id="builder">Mutation builder</H2>
      <CodeBlock lang="ts" code={`discovery.mutate(deployments)
  .update({ id: "dep_123" }, { status: "stopped" })
  .returning(["id", "status"]);

discovery.mutate(deployments).create({ name: "api-edge", environment: "prod", status: "pending" });
discovery.mutate(deployments).delete({ id: "dep_123" });
discovery.mutate(deployments).invoke("restart", { id: "dep_123", graceMs: 5000 });`} />

      <H2 id="strategy">Strategies &amp; ownership</H2>
      <P>Pick a strategy on the mutation or accept the entity's default. Switch between them below to see the propagation.</P>
      <MutationStrategy />
      <UL>
        <li><strong>owner-only</strong> — single-writer; lowest latency, strongest consistency for that entity.</li>
        <li><strong>quorum</strong> — survives single-node loss; tolerates partition for the minority.</li>
        <li><strong>broadcast</strong> — used for system-wide configuration; requires every reachable node.</li>
      </UL>

      <H2 id="optimistic">Optimistic mutations</H2>
      <CodeBlock lang="ts" code={`discovery.mutate(deployments)
  .update({ id }, { status: "stopping" })
  .optimistic((cache) => cache.patch(id, { status: "stopping" }))
  .rollbackOn("error");`} />
      <P>Optimistic patches are applied to local query caches immediately. If the mutation fails the patch is reverted and any subscriber receives the corrected snapshot.</P>

      <H2 id="saga">Distributed sagas</H2>
      <P>Multi-step workflows that span services use a saga: each step has a forward action and a compensation. Failures roll back in reverse.</P>
      <SagaTimeline />
      <H3>Defining a saga</H3>
      <CodeBlock lang="ts" code={`saga("provision-deployment")
  .step("reserve-quota", reserveQuota, releaseQuota)
  .step("create-deployment", createDeployment, destroyDeployment)
  .step("allocate-replicas", allocateReplicas, freeReplicas)
  .step("wire-routing", wireRouting, tearDownRoutes)
  .step("publish-event", publishCreated, publishRolledBack);`} />
      <Callout variant="warn">Compensations must be idempotent — they may be retried if the coordinator itself crashes mid-rollback.</Callout>
    </article>
  ),
});
