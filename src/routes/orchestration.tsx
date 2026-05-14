import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, P, UL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { BootstrapWizard } from "@/components/interactive/BootstrapWizard";
import { ContainerLifecycle } from "@/components/interactive/ContainerLifecycle";

export const Route = createFileRoute("/orchestration")({
  head: () => ({
    meta: [
      { title: "Startup model — Mesh" },
      { name: "description", content: "First-run setup gate, root container ownership, and clean uninstall behavior." },
      { property: "og:title", content: "Startup model — Mesh" },
      { property: "og:description", content: "How the mesh-orchestrated runtime starts, persists peer URLs, and shuts down cleanly." },
    ],
  }),
  component: () => (
    <article>
      <PageHeader eyebrow="Bootstrap & lifecycle" title="Startup model" lead="On first boot only the API and web app run. A required setup gate decides whether to create or join a mesh. After that, every restart re-uses the persisted state." />

      <Callout variant="tldr">Setup is the only allowed path on first boot. The user picks <em>create new mesh</em> or <em>join existing mesh</em>. Mesh URLs are persisted; subsequent boots reconnect automatically.</Callout>

      <H2 id="wizard">First-run wizard</H2>
      <BootstrapWizard />

      <H2 id="root-container">Root container ownership</H2>
      <P>Only one container is installed by the user — the <strong>root container</strong> (API + web). Every other runtime container is created by the orchestration layer as a child of root.</P>
      <UL>
        <li>Root is the ownership boundary for cleanup.</li>
        <li>Children are tied to root's lifecycle.</li>
        <li>Uninstalling root must terminate every child automatically — no orphans.</li>
      </UL>

      <H2 id="uninstall">Uninstall demo</H2>
      <P>Hit the button to remove the root. Children must self-terminate in dependency-safe reverse order.</P>
      <ContainerLifecycle />

      <H2 id="rules">Lifecycle rules</H2>
      <UL>
        <li>No mutation runs before the setup gate completes.</li>
        <li>Persisted mesh URLs live in the <strong>local DB</strong>, not in env vars.</li>
        <li>If identity material is missing on second boot, the system halts and surfaces an error — it does not silently re-prompt.</li>
        <li>The web app is the only allowed UI surface during setup.</li>
      </UL>
    </article>
  ),
});
