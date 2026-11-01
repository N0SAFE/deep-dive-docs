import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, P } from "@/components/doc/Prose";
import { MeshConsumerBoundary } from "@/components/interactive/MeshConsumerBoundary";
import { MeshPeerSelectionVisual } from "@/components/interactive/MeshPeerSelectionVisual";
import { PeerScoreCalculator } from "@/components/interactive/PeerScoreCalculator";
import { SagaTimeline } from "@/components/interactive/SagaTimeline";
import { QueryPlayground } from "@/components/interactive/QueryPlayground";
import { LiveQuerySim } from "@/components/interactive/LiveQuerySim";
import { ModuleChain } from "@/components/interactive/ModuleChain";
import { MeshOrchestrationFlow } from "@/components/interactive/MeshOrchestrationFlow";
import { CodeBlock } from "@/components/doc/CodeBlock";

export const Route = createFileRoute("/interactive-examples")({
  component: InteractiveExamples,
});

function InteractiveExamples() {
  return (
    <article className="space-y-12">
      <PageHeader
        eyebrow="Demos"
        title="Interactive Examples"
        lead="A deep dive collection of interactive visualizations and playgrounds exploring how the mesh coordinates, discovers, routes, and handles faults."
      />

      <section>
        <h2 className="text-2xl font-bold font-display tracking-tight text-foreground mb-3">1. Mesh Consumer Boundary</h2>
        <P>Separation of mesh transport from domain business logic.</P>
        <MeshConsumerBoundary />
      </section>

      <section>
        <h2 className="text-2xl font-bold font-display tracking-tight text-foreground mb-3">2. Peer Selection Visualizer</h2>
        <P>Visualizes how nodes construct a network topology dynamically.</P>
        <MeshPeerSelectionVisual />
      </section>

      <section>
        <h2 className="text-2xl font-bold font-display tracking-tight text-foreground mb-3">3. Peer Score Math</h2>
        <P>Adjust network constraints to see how the mathematical scoring formula dictates routing metrics.</P>
        <PeerScoreCalculator />
      </section>

      <section>
        <h2 className="text-2xl font-bold font-display tracking-tight text-foreground mb-3">4. Saga Timeline</h2>
        <P>Distributed transaction visualization with compensation logic.</P>
        <SagaTimeline />
      </section>

      <section>
        <h2 className="text-2xl font-bold font-display tracking-tight text-foreground mb-3">5. Query Builder Playground</h2>
        <P>Build and test federated queries using the interactive syntax engine.</P>
        <QueryPlayground />
      </section>

      <section>
        <h2 className="text-2xl font-bold font-display tracking-tight text-foreground mb-3">6. Live Query Simulator</h2>
        <P>Real-time stream and query updates fed from multiple connected peers.</P>
        <LiveQuerySim />
      </section>

      <section>
        <h2 className="text-2xl font-bold font-display tracking-tight text-foreground mb-3">7. Orchestration Flow</h2>
        <P>Lifecycle stages of how nodes join the mesh and bootstrap dependencies.</P>
        <MeshOrchestrationFlow />
      </section>
      
      <section>
        <h2 className="text-2xl font-bold font-display tracking-tight text-foreground mb-3">8. Module Lifecycle Chain</h2>
        <P>Visualizes the DAG of dependencies for how features are brought online in deterministic order.</P>
        <ModuleChain />
      </section>

    </article>
  );
}
