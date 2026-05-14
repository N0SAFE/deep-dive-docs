import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, OL, UL } from "@/components/doc/Prose";
import { CodeBlock } from "@/components/doc/CodeBlock";

export const Route = createFileRoute("/reference")({
  head: () => ({
    meta: [
      { title: "Reference — Mesh" },
      { name: "description", content: "File structure, implementation order, and the full list of system invariants." },
      { property: "og:title", content: "Reference — Mesh" },
      { property: "og:description", content: "Reference: file layout, build order, and invariants for the mesh architecture." },
    ],
  }),
  component: () => (
    <article>
      <PageHeader eyebrow="Reference" title="Files, order, invariants" lead="Quick-jump reference for builders implementing the spec." />

      <H2 id="files">File structure</H2>
      <CodeBlock lang="bash" code={`packages/mesh/
├── core/
│   ├── operation.ts            # meshOperation primitive
│   ├── entity.ts               # meshEntity primitive
│   ├── mutation.ts             # meshMutation primitive
│   ├── relation.ts             # meshRelation primitive
│   └── service.ts              # service composition + registration
├── query/
│   ├── builder.ts              # from/where/select/join/orderBy/limit
│   ├── plan.ts                 # plan tree types + EXPLAIN
│   ├── exec.ts                 # planner → executor
│   ├── dedup.ts                # primary-key dedup window
│   ├── aggregate.ts            # mergeable aggregations
│   └── cache.ts                # event-invalidated cache
├── runtime/
│   ├── discovery.ts            # registry + topic derivation + routing
│   ├── peer-selection.ts       # scoring, k-degree, hysteresis
│   ├── transport.ts            # ORPC bindings
│   └── middleware.ts           # use() pipeline
├── bootstrap/
│   ├── container.ts            # module DI container
│   ├── modules/
│   │   ├── config.ts
│   │   ├── db.ts
│   │   ├── identity.ts
│   │   ├── mesh-client.ts
│   │   ├── discovery.ts
│   │   ├── scheduler.ts
│   │   ├── router.ts
│   │   └── api.ts
│   └── lifecycle.ts            # ready / shutdown / failure handling
├── auth/
│   ├── portal-client.ts        # first-run handshake
│   ├── identity.ts             # keypair + signing
│   └── revocation.ts
└── orchestration/
    ├── setup-gate.ts
    └── container-lifecycle.ts`} />

      <H2 id="order">Implementation order</H2>
      <OL>
        <li><strong>Primitives</strong> — operation, entity, mutation, relation. No transport yet.</li>
        <li><strong>Plan + builder</strong> — pure data; produce plans without executing.</li>
        <li><strong>Discovery + topic derivation</strong> — registry, topic strings, no fanout.</li>
        <li><strong>Transport (ORPC) + auth identity</strong> — sign and verify; one node at a time.</li>
        <li><strong>Single-peer execution</strong> — query end-to-end against one node.</li>
        <li><strong>Fanout + dedup + merge</strong> — multi-peer queries.</li>
        <li><strong>Mutation strategies</strong> — owner-only, then quorum, then broadcast.</li>
        <li><strong>Live queries</strong> — change-stream invalidation + Observable surface.</li>
        <li><strong>Aggregation engine</strong> — mergeable operators, then percentiles.</li>
        <li><strong>Peer selection</strong> — scoring, k-degree, hysteresis.</li>
        <li><strong>Bootstrap container + module chain</strong>.</li>
        <li><strong>Setup gate + container lifecycle</strong> — first-run wizard, root ownership.</li>
        <li><strong>Saga coordinator</strong> — last; depends on mutation strategies + observables.</li>
      </OL>

      <H2 id="invariants">All system invariants</H2>
      <UL>
        <li>An entity's primary key uniquely identifies it across all peers.</li>
        <li>A service registers entities, not topics — topics are derived.</li>
        <li>Every query is observable; sync results emit once, then complete.</li>
        <li>Predicates are pushed down to peers before merging.</li>
        <li>Merged streams pass through a primary-key dedup window before emission.</li>
        <li>Aggregations must be mergeable monoids; non-mergeable forms warn in EXPLAIN.</li>
        <li>No mutation may run before the setup gate completes.</li>
        <li>No module starts before its dependencies report <code>ready</code>.</li>
        <li>Mesh peer URLs are persisted in local DB; restarts never re-prompt.</li>
        <li>Node identity, once sealed, is the sole authority for mesh control calls.</li>
        <li>Owner-only mutations target a single node; quorum requires ⌈N/2⌉+1 acks.</li>
        <li>Saga compensations must be idempotent.</li>
        <li>Uninstalling the root container terminates every child container.</li>
        <li>If identity material is missing on second boot, the system halts.</li>
        <li>Peer demotion requires worse-score persistence over a window <em>W</em>.</li>
        <li><code>scope: "internal"</code> operations never appear on the public API.</li>
      </UL>
    </article>
  ),
});
