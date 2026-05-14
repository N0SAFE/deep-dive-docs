import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, P, UL, OL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { MeshOrchestrationFlow } from "@/components/interactive/MeshOrchestrationFlow";

export const Route = createFileRoute("/mesh-startup")({
  head: () => ({
    meta: [
      { title: "Mesh Startup & Orchestration — Mesh" },
      { name: "description", content: "How the mesh bootstrap process works: setup gate, mesh orchestration, and database integration." },
      { property: "og:title", content: "Mesh Startup & Orchestration — Mesh" },
      { property: "og:description", content: "Startup model for mesh-orchestrated systems with required setup gates and blocking hierarchy." },
    ],
  }),
  component: () => (
    <article>
      <PageHeader
        eyebrow="Lifecycle"
        title="Mesh Startup & Orchestration"
        lead="The mesh is part of the startup bootstrap chain. Setup blocks mesh, mesh blocks database, database blocks everything else."
      />

      <Callout variant="tldr">
        First-run requires setup. On boot, orchestration reads persisted mesh URLs. Mesh runtime discovers peers. Database waits for
        mesh to provide connection URL. All dependent modules wait for database. This is not optional.
      </Callout>

      <H2 id="why">Why this matters</H2>
      <P>
        The mesh is not just a transport layer. It is part of the startup bootstrap chain. That means database, setup, and mesh
        runtime need a strict order instead of starting independently.
      </P>

      <P>
        Benefits of this ordering:
      </P>
      <UL>
        <li>Deterministic startup: no race conditions or partial init states.</li>
        <li>Failure is loud: if any stage fails, the system halts. No silent degradation.</li>
        <li>Restart recovery: persisted mesh URLs make restart-recovery automatic.</li>
        <li>Single source of truth: database and mesh topology are kept in sync.</li>
      </UL>

      <H2 id="interactive">Startup sequence</H2>
      <P>Click "boot" below to see the full orchestration sequence:</P>
      <MeshOrchestrationFlow />

      <H2 id="phases">Startup phases in detail</H2>

      <H2 id="phase1">Phase 1: Setup Module</H2>
      <UL>
        <li>
          <strong>Runs only on first boot.</strong> Subsequent boots skip it if setup is already complete.
        </li>
        <li>
          <strong>User choice:</strong> "Create new mesh" or "Join existing mesh".
        </li>
        <li>
          <strong>First-time user creation.</strong> Superadmin bootstrap identity.
        </li>
        <li>
          <strong>Blocks everything downstream.</strong> Mesh orchestration cannot start until setup reports complete.
        </li>
      </UL>

      <H2 id="phase2">Phase 2: Mesh Orchestration Service</H2>
      <UL>
        <li>
          <strong>On first boot:</strong> stores the discovered mesh cluster URL in local DB.
        </li>
        <li>
          <strong>On subsequent boots:</strong> reads persisted URLs from local DB and reconnects automatically.
        </li>
        <li>
          <strong>If reconnection fails:</strong> the system halts (loud failure, not silent retry loop).
        </li>
        <li>
          <strong>Blocks database startup.</strong> Mesh orchestration must be ready before database module starts.
        </li>
      </UL>

      <H2 id="phase3">Phase 3: Mesh Core Runtime</H2>
      <UL>
        <li>
          <strong>Discovers peers:</strong> queries the fleet registry for active nodes.
        </li>
        <li>
          <strong>Performs authenticated handshakes:</strong> verifies node identity via signed control calls.
        </li>
        <li>
          <strong>Establishes control-plane connections:</strong> opens ORPC EventIterator streams to peers.
        </li>
        <li>
          <strong>Provides runtime database URL.</strong> Once ready, mesh publishes the database URL to be used by the database
          module.
        </li>
      </UL>

      <H2 id="phase4">Phase 4: Global Database Module</H2>
      <UL>
        <li>
          <strong>Waits for mesh to provide URL.</strong> This is the critical gate.
        </li>
        <li>
          <strong>Opens connection to runtime database.</strong> Uses URL provided by mesh orchestration.
        </li>
        <li>
          <strong>Runs pending migrations.</strong> Ensures schema is up-to-date.
        </li>
        <li>
          <strong>Blocks all DB-dependent modules.</strong> Nothing starts until this completes.
        </li>
      </UL>

      <H2 id="phase5">Phase 5: Feature Modules</H2>
      <UL>
        <li>
          <strong>Deployment module:</strong> depends on database, can now start.
        </li>
        <li>
          <strong>Service module:</strong> depends on database, can now start.
        </li>
        <li>
          <strong>All domain modules:</strong> consume mesh streams and database as needed.
        </li>
        <li>
          <strong>API surface exposed:</strong> only after all modules report ready.
        </li>
      </UL>

      <H2 id="blocking">Blocking hierarchy</H2>
      <P>This is strict and enforced:</P>

      <OL>
        <li>Setup blocks mesh orchestration until onboarding is completed.</li>
        <li>Mesh orchestration blocks database startup until it has the runtime database URL.</li>
        <li>Database startup blocks all DB-dependent modules.</li>
        <li>Mesh core runtime depends on orchestration bootstrap data and on the persisted mesh snapshot.</li>
      </OL>

      <Callout variant="warn" title="No mutations before setup gate">
        Do not allow any write operation (deployment create, service update, etc.) before the setup gate completes. All mutations
        are gated behind setup.complete === true.
      </Callout>

      <H2 id="persistence">Persistence & Restart Recovery</H2>
      <P>On first successful mesh connection:</P>
      <UL>
        <li>Orchestration layer persists discovered node URLs in the local DB.</li>
        <li>These URLs are stored in a table like `mesh_bootstrap_nodes`.</li>
        <li>On boot, orchestration reads these URLs first before discovery.</li>
      </UL>

      <P>On restart:</P>
      <UL>
        <li>Setup is skipped if `setup_complete = true` in DB.</li>
        <li>Mesh orchestration reads persisted URLs immediately.</li>
        <li>Reconnect to same cluster automatically.</li>
        <li>If all persisted URLs fail, then run discovery (fallback).</li>
      </UL>

      <H2 id="observable">Observable-first usage</H2>
      <P>All mesh calls must expose observables directly so consumers can apply RxJS operators:</P>

      <UL>
        <li>
          <code>map</code>, <code>filter</code>, <code>mergeMap</code>, <code>take</code>, <code>scan</code>, <code>timeout</code>
        </li>
        <li>Compose multiple streams with <code>merge</code>, <code>combineLatest</code>, <code>zip</code></li>
        <li>Never hide the observable behind promise-style APIs only.</li>
      </UL>

      <Callout variant="success" title="Design rule">
        Mesh calls should expose observables directly. Do not hide the stream behind only promise-style APIs. The observable must
        remain accessible for composition.
      </Callout>
    </article>
  ),
});
