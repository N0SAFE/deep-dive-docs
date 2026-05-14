import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, H3, P, UL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { CodeBlock } from "@/components/doc/CodeBlock";

export const Route = createFileRoute("/primitives")({
  head: () => ({
    meta: [
      { title: "Primitives — Mesh" },
      { name: "description", content: "The four building blocks: meshOperation, meshEntity, meshMutation, and meshRelation." },
      { property: "og:title", content: "Primitives — Mesh" },
      { property: "og:description", content: "Define services with meshOperation, meshEntity, meshMutation, and meshRelation." },
    ],
  }),
  component: Primitives,
});

function Primitives() {
  return (
    <article>
      <PageHeader
        eyebrow="Query layer"
        title="Primitives"
        lead="Four primitives describe everything a service exposes. Together they generate transport, types, and the discovery surface."
      />

      <Callout variant="tldr">
        <strong>meshOperation</strong> is the unit. <strong>meshEntity</strong> is a queryable table.{" "}
        <strong>meshMutation</strong> is a write. <strong>meshRelation</strong> wires entities together so
        joins can be inferred.
      </Callout>

      <H2 id="operation">meshOperation()</H2>
      <P>
        The lowest-level primitive. Every other primitive is a <code>meshOperation</code> with a particular
        shape (read vs. write vs. stream). It owns: input validation, output validation, scope, strategy, and
        the handler.
      </P>
      <CodeBlock
        lang="ts"
        code={`export const ping = meshOperation()
  .input(z.object({ from: z.string() }))
  .output(z.object({ pong: z.literal(true), at: z.number() }))
  .scope("internal")        // not exposed via public API
  .strategy("any-peer")     // can be served by any node
  .handler(async ({ input }) => ({ pong: true as const, at: Date.now() }));`}
      />

      <H2 id="entity">meshEntity()</H2>
      <P>
        Declares a queryable distributed table. The runtime derives the read topic, the change-stream topic,
        and the indexes from this declaration.
      </P>
      <CodeBlock
        lang="ts"
        code={`export const deployments = meshEntity({
  name: "deployments",
  primaryKey: "id",
  shape: z.object({
    id: z.string(),
    name: z.string(),
    status: z.enum(["pending", "running", "failing", "stopped"]),
    environment: z.string(),
    ownerNode: z.string(),
    createdAt: z.number(),
  }),
  indexes: ["status", "environment", ["environment", "status"]],
});`}
      />
      <P>
        The shape is the source of truth. The query builder, the live-query stream, and the dedup engine all
        infer their types from it.
      </P>

      <H2 id="mutation">meshMutation()</H2>
      <P>A typed write that the system routes according to the entity's strategy.</P>
      <CodeBlock
        lang="ts"
        code={`export const updateStatus = meshMutation({
  entity: deployments,
  name: "updateStatus",
  input: z.object({ id: z.string(), status: deployments.shape.shape.status }),
  strategy: "owner-only",
  handler: async ({ input, ctx }) => {
    await ctx.db.update(deployments).set({ status: input.status }).where(eq(deployments.id, input.id));
    return { ok: true };
  },
});`}
      />

      <H2 id="relation">meshRelation()</H2>
      <P>
        Declares how two entities connect. The query builder uses these to infer auto-joins, so callers don't
        repeat the join condition every time.
      </P>
      <CodeBlock
        lang="ts"
        code={`meshRelation({
  from: deployments,
  to: metrics,
  on: (d, m) => eq(d.id, m.deploymentId),
  cardinality: "one-to-many",
  alias: "metrics",
});`}
      />

      <H3>Now joins write themselves</H3>
      <CodeBlock
        lang="ts"
        code={`discovery
  .from(deployments)
  .with("metrics")          // resolved from the relation, fully typed
  .where({ status: "running" });`}
      />

      <H2 id="composition">Composition rules</H2>
      <UL>
        <li>An entity belongs to exactly one service.</li>
        <li>A relation can cross services — discovery handles the cross-node join.</li>
        <li>Mutations always target a single entity, even if their handler updates more.</li>
        <li>Operations marked <code>scope: "internal"</code> never appear on the public API surface.</li>
      </UL>
    </article>
  );
}
