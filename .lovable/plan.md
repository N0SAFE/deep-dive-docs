
## Goal

Build an interactive documentation site that explains, in depth, every concept from the uploaded `mesh-doc.html` plus the supporting markdown files (`mesh-orchestration-startup-model.md`, `mesh-peer-selection-algorithm.md`, `mesh-resource-discovery-v2-pattern.md`, `PLATFORM_SOURCE_OF_TRUTH.md`).

Not a 1:1 port of the HTML — a richer, more pedagogical version with interactive widgets, animated diagrams, runnable examples, and cross-linking.

## Visual direction

Reuse the source HTML's design language so it feels native to the spec:
- Dark indigo background (`#09090f` → `#141422`), indigo/teal accents (`#5b5bff`, `#00d4b4`)
- Fonts: Syne (headings), DM Sans (body), Fira Code (code)
- Fixed left sidebar (280px) with section nav + scroll-spy progress bar at top
- Generous whitespace, monospace code blocks with syntax highlighting

All tokens go into `src/styles.css` (oklch).

## Information architecture (TanStack Start routes)

Each major chapter = its own route (SSR + SEO + shareable). Sidebar links to all of them. Sub-sections inside a route use scroll anchors.

```
/                          Overview + vision + "what is the mesh"
/concepts                  Concept shift, design principles, invariants
/primitives                meshOperation, meshEntity, meshMutation, meshRelation
/query-builder             From/where/select/order/pagination/subqueries
/joins                     Joins, auto-joins, nested, type inference
/aggregation               Distributed aggregation engine
/mutations                 Mutation builder, strategies, optimistic, sagas
/live                      Live queries + typed event subscriptions
/execution                 Execution engine, dedup, middleware, caching, EXPLAIN
/discovery                 Discovery service + topic derivation
/peer-selection            Algorithm phases + scoring formula + interactive calc
/orchestration             Startup model, first-run setup, container lifecycle
/auth                      First mesh auth bootstrap, asymmetric identity
/bootstrap                 Bootstrap flows, memory model, async module chain
/api                       Observable-first API, RxJS usage
/examples                  End-to-end runnable examples
/reference                 File structure, implementation order, full invariants list
```

## Interactive elements (the "interactive" part)

1. **Scroll-spy sidebar + reading-progress bar** — current section highlights, % progress across the doc.
2. **Animated mesh topology diagram** (`/discovery`, `/peer-selection`) — SVG nodes that pulse, reorganize when you change fleet size / capacity sliders.
3. **Peer-score calculator** (`/peer-selection`) — sliders for latency, jitter, queue, memory, capacity, weights; live computes `Score` and `k` (target peer degree) using the doc's formulas; shows a ranked candidate table.
4. **Query builder playground** (`/query-builder`, `/joins`) — pick entities from a fake `DeploymentMeshService`, toggle where/select/join/orderBy clauses; renders the equivalent TS code + a fake "execution plan" tree.
5. **EXPLAIN visualizer** (`/execution`) — clickable plan-tree nodes that reveal the stage (scan → filter → join → aggregate → dedup) with timing badges.
6. **Mutation strategy switcher** (`/mutations`) — toggle owner-only / quorum / optimistic; animation shows how writes propagate across nodes.
7. **Saga timeline** (`/mutations`) — step-through a distributed saga with compensations on failure (play / step / reset controls).
8. **Live-query simulator** (`/live`) — fake event stream pushes rows into a table in real time; pause / resume.
9. **Bootstrap flow walkthrough** (`/orchestration`, `/bootstrap`) — multi-step wizard mock (join existing mesh vs. create new) with the actual decision tree.
10. **Container lifecycle diagram** (`/orchestration`) — root container → child containers, with an "uninstall" button that animates correct teardown order.
11. **Async module chain visualizer** (`/bootstrap`) — ordered modules with state (pending → ready → live), shows dependency edges.
12. **Auth handshake animation** (`/auth`) — sequence diagram: node → portal → superadmin → lifetime usage → keypair, click each step to expand.
13. **Glossary tooltips** — hover any term (Candidate, Peer, Latency budget, Capacity index, Quorum, Saga, etc.) for an inline definition.
14. **Copy-to-clipboard** on every code block, with language tabs where relevant.
15. **Search** (cmd-K) — fuzzy search across all section titles + glossary terms; jumps to route + anchor.
16. **Light/dark toggle** — dark by default (matches source); light variant uses the same accent system.

## Content depth

For each concept the page contains, in order:
1. **TL;DR** callout (1–2 sentences).
2. **Why it exists** — the problem it solves, drawn from `PLATFORM_SOURCE_OF_TRUTH.md` and the v2 pattern doc.
3. **How it works** — prose + diagram + annotated code.
4. **Formulas / invariants** rendered with KaTeX where math appears (peer scoring, k computation, hysteresis).
5. **Worked example** with input → output.
6. **Edge cases & gotchas** (auth failures, churn, dedup races, etc.).
7. **Related** links to neighboring concepts.

Math from `mesh-peer-selection-algorithm.md` (Score, K_base, K_capacity, K_latency, hysteresis) renders via KaTeX. Code samples from the v2 pattern doc render via Shiki / a lightweight highlighter.

## Technical notes

- **Stack**: existing TanStack Start + Tailwind v4 + shadcn (already in project). No backend needed — pure static content.
- **Route files**: one per chapter under `src/routes/`. Each sets its own `head()` (title, description, og:title, og:description).
- **Shared layout**: `__root.tsx` keeps the doc shell (sidebar + main + progress bar) and renders `<Outlet />`.
- **Content**: stored as TSX components under `src/content/<chapter>/` so prose, code, and interactive widgets live together. No CMS / MDX runtime needed.
- **Interactive widgets**: components under `src/components/interactive/` (PeerScoreCalculator, QueryPlayground, MeshTopology, SagaTimeline, etc.). All client-side React with `useState` / `framer-motion`.
- **Diagrams**: hand-rolled SVG + framer-motion (no heavy graph lib). Mesh topology uses force-ish static layout precomputed per node count.
- **Math**: `katex` package, server-rendered to HTML strings at build time (KaTeX is Worker-safe).
- **Syntax highlighting**: `shiki` with one dark theme (`github-dark-dimmed`), tree-shaken to TS / TSX / bash grammars.
- **Search**: `fuse.js` over a generated index of section titles + glossary.
- **No new backend**: no Lovable Cloud, no auth, no DB. Pure docs.

## Out of scope

- Building an actual mesh/runtime — this is documentation only, with simulated demos.
- Editing the source uploaded files.
- Auth, persistence, or user accounts.

## Build order

1. Design tokens + sidebar shell + scroll-spy + progress bar in `__root.tsx`.
2. Route scaffolding (all 16 routes with proper `head()`).
3. Shared primitives: `<Callout>`, `<CodeBlock>` (Shiki), `<Math>` (KaTeX), `<Glossary>`, `<SectionNav>`.
4. Content pass 1 — prose + code + static diagrams for every chapter.
5. Interactive widgets, one per chapter (calculator → playground → topology → saga → live sim → bootstrap wizard → container lifecycle → auth animation → module chain).
6. Cmd-K search + glossary tooltips.
7. Polish: transitions, empty states, mobile sidebar drawer, copy buttons.
