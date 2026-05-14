export type DocSection = {
  group: string;
  items: { to: string; title: string; blurb?: string }[];
};

export const DOC_NAV: DocSection[] = [
  {
    group: "Foundations",
    items: [
      { to: "/", title: "Overview", blurb: "What the mesh is and why it exists" },
      { to: "/concepts", title: "Core concepts", blurb: "Concept shift, principles, invariants" },
    ],
  },
  {
    group: "Query Layer",
    items: [
      { to: "/primitives", title: "Primitives", blurb: "meshOperation, meshEntity, meshMutation, meshRelation" },
      { to: "/query-builder", title: "Query builder", blurb: "from / where / select / order / paginate" },
      { to: "/joins", title: "Joins", blurb: "Auto-joins, nested, type inference" },
      { to: "/aggregation", title: "Aggregation", blurb: "Distributed aggregation engine" },
    ],
  },
  {
    group: "Writes & Reactivity",
    items: [
      { to: "/mutations", title: "Mutations", blurb: "Builder, strategies, optimistic, sagas" },
      { to: "/live", title: "Live queries", blurb: "Reactive streams + typed events" },
    ],
  },
  {
    group: "Runtime",
    items: [
      { to: "/execution", title: "Execution engine", blurb: "Plan, dedup, middleware, caching, EXPLAIN" },
      { to: "/discovery", title: "Discovery service", blurb: "Topic derivation, fleet registry" },
      { to: "/peer-selection", title: "Peer selection", blurb: "Adaptive topology + scoring calculator" },
      { to: "/mesh-peer-scoring", title: "Peer scoring algorithm", blurb: "Interactive peer selection with weights and tuning" },
    ],
  },
  {
    group: "Bootstrap & Lifecycle",
    items: [
      { to: "/orchestration", title: "Startup model", blurb: "First-run setup, container lifecycle" },
      { to: "/auth", title: "Mesh auth", blurb: "Asymmetric node identity bootstrap" },
      { to: "/bootstrap", title: "Bootstrap flows", blurb: "Memory model + module chain" },
      { to: "/mesh-startup", title: "Mesh orchestration", blurb: "Startup sequence and blocking hierarchy" },
      { to: "/api", title: "Observable API", blurb: "RxJS-first surface" },
    ],
  },
  {
    group: "Architecture Patterns",
    items: [
      { to: "/mesh-consumer-boundary", title: "Mesh-consumer boundary", blurb: "Separation of transport and domain logic" },
    ],
  },
  {
    group: "Reference",
    items: [
      { to: "/examples", title: "End-to-end examples" },
      { to: "/reference", title: "Files, order, invariants" },
    ],
  },
];

export const FLAT_NAV = DOC_NAV.flatMap((g) => g.items);
