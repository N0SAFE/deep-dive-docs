import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, H3, P, UL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { CodeBlock } from "@/components/doc/CodeBlock";
import { MeshConsumerBoundary } from "@/components/interactive/MeshConsumerBoundary";

export const Route = createFileRoute("/mesh-consumer-boundary")({
  head: () => ({
    meta: [
      { title: "Mesh-Consumer Boundary — Mesh" },
      { name: "description", content: "How to keep mesh transport separate from domain business logic through contract-first architecture." },
      { property: "og:title", content: "Mesh-Consumer Boundary — Mesh" },
      { property: "og:description", content: "Design pattern for separating mesh concerns from domain business logic." },
    ],
  }),
  component: () => (
    <article>
      <PageHeader
        eyebrow="Architecture Patterns"
        title="Mesh-Consumer Boundary"
        lead="Keep mesh focused on transport and discovery. Let feature modules own business workflows. Use contracts to enforce the split."
      />

      <Callout variant="tldr">
        Mesh handles <em>where things live and how to connect</em>. Feature modules handle{" "}
        <em>what things mean and what to do with them</em>.
      </Callout>

      <H2 id="why">Why this matters</H2>
      <P>
        When stream/event features grow, mesh code drifts into business concerns (deployment lifecycle, domain rules, retries,
        ownership semantics). That coupling makes everything harder to evolve and harder to test independently.
      </P>

      <H2 id="visual">Interactive boundary split</H2>
      <MeshConsumerBoundary />

      <H2 id="pattern">Three service roles</H2>
      <H3>1) ConsumerStreamOrchestrator (feature module)</H3>
      <UL>
        <li>Decides whether stream is local or remote</li>
        <li>Asks mesh for a stream channel when remote</li>
        <li>Merges replay/filter business rules with domain semantics</li>
      </UL>

      <H3>2) MeshStreamRuntimeService (core mesh module)</H3>
      <UL>
        <li>Discovers owner node/resource</li>
        <li>Opens transport (SSE/HTTP stream/WebSocket)</li>
        <li>Returns typed observable stream with cancellation and error propagation</li>
      </UL>

      <H3>3) DomainBusinessService (feature module)</H3>
      <UL>
        <li>Interprets domain events</li>
        <li>Performs state transitions, policy checks, side effects</li>
      </UL>

      <H2 id="contracts">Contract-first strategy</H2>
      <P>Use two contract families with strict ownership boundaries:</P>

      <H3>Consumer contracts (business-facing)</H3>
      <P>Owned by feature modules (deployment, project, service, etc.):</P>
      <UL>
        <li>Input/output schemas for domain events</li>
        <li>Replay semantics and query filters meaningful to that domain</li>
        <li>Authorization and business constraints</li>
      </UL>

      <H3>Mesh runtime contracts (platform-facing)</H3>
      <P>Owned by mesh core module:</P>
      <UL>
        <li>Resource registration/lookup</li>
        <li>Connection/bridge lifecycle</li>
        <li>Transport options (SSE, HTTP stream, websocket)</li>
        <li>Bridge policy and health metadata</li>
      </UL>

      <Callout variant="warn" title="Boundary rule">
        Consumer contracts must never expose mesh internals as business API. Mesh contracts must never encode domain-specific
        business rules.
      </Callout>

      <H2 id="example">Concrete code example</H2>
      <P>Deployment module opens a log stream. Here is the boundary in action:</P>

      <H3>Step 1: Thin controller validates input</H3>
      <CodeBlock
        lang="ts"
        code={`@Implement(appContract.deployment.stream)
stream() {
  return implement(appContract.deployment.stream)
    .use(requireAuth())
    .handler(({ input, context }) => {
      return this.deploymentStreamOrchestrator.openStream({
        deploymentId: input.params.id,
        replay: input.query.replay,
        replayLimit: input.query.replayLimit,
        headers: this.buildProxyHeaders(context),
      });
    });
}`}
      />

      <H3>Step 2: Orchestrator decides local or remote</H3>
      <CodeBlock
        lang="ts"
        code={`openStream(input: StreamInput): Observable<DeploymentEvent> {
  const key = \`stream:deployment:\${input.deploymentId}\`;
  const owner = this.meshTopology.lookupResource(key);

  if (owner.ownerNodeId === this.localNodeId) {
    // Local: ask business service
    return this.deploymentService.streamEvents(input);
  }

  // Remote: ask mesh runtime to bridge
  return this.meshRuntime.openBridge({
    resourceKey: key,
    transport: "sse",
    forwardAuth: true,
  }, input.headers);
}`}
      />

      <H3>Step 3: Mesh runtime handles transport only</H3>
      <CodeBlock
        lang="ts"
        code={`openBridge(input: MeshOpenBridgeInput, headers: Headers): Observable<unknown> {
  // Mesh concerns only:
  // 1) lookup resource owner in mesh directory
  // 2) connect over selected transport
  // 3) parse frames + map envelope -> unknown
  // 4) propagate cancellation/errors

  // NO business logic here. NO domain decisions.
  return this.transport.connect(owner, input);
}`}
      />

      <H2 id="benefits">Benefits of this split</H2>
      <UL>
        <li>
          <strong>Testability:</strong> mock MeshStreamRuntimeService independently. Test business logic without network.
        </li>
        <li>
          <strong>Reusability:</strong> mesh services work for any domain. Domains don't re-implement transport logic.
        </li>
        <li>
          <strong>Clarity:</strong> readers know exactly where business semantics end and transport begins.
        </li>
        <li>
          <strong>Evolution:</strong> add bridge modes, new transports, or topologies without touching domain code.
        </li>
      </UL>

      <H2 id="antipatterns">Anti-patterns to avoid</H2>
      <UL>
        <li>Parsing SSE frames directly in feature controllers.</li>
        <li>Embedding domain decisions into mesh runtime.</li>
        <li>Leaking mesh resource keys or node topology into public business contracts.</li>
        <li>Duplicating connection/abort/error logic per feature.</li>
        <li>Exposing private mesh control endpoints on public ingress.</li>
      </UL>

      <Callout variant="success" title="Concrete boundary check">
        If you can delete/replace the mesh transport implementation without touching domain semantics, your boundary is correct.
      </Callout>
    </article>
  ),
});
