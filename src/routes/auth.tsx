import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, H2, P, UL } from "@/components/doc/Prose";
import { Callout } from "@/components/doc/Callout";
import { CodeBlock } from "@/components/doc/CodeBlock";
import { AuthHandshake } from "@/components/interactive/AuthHandshake";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Mesh auth — Mesh" },
      { name: "description", content: "Bootstrapping a long-lived asymmetric node identity from a single superadmin sign-in." },
      { property: "og:title", content: "Mesh auth — Mesh" },
      { property: "og:description", content: "How the first-run mesh auth handshake upgrades a session into a sealed node identity." },
    ],
  }),
  component: () => (
    <article>
      <PageHeader eyebrow="Bootstrap & lifecycle" title="First mesh authentication" lead="On the very first boot the node authenticates once, then keeps a long-lived asymmetric identity. There's no recurring login token." />

      <Callout variant="tldr">A superadmin signs in at the mesh auth portal. The node trades that session for a <em>lifetime auth usage</em> bound to its public key. Every future mesh control call is signed by the node's private key.</Callout>

      <H2 id="sequence">Handshake sequence</H2>
      <P>Step through each message — the active arrow lights up and the right panel describes it.</P>
      <AuthHandshake />

      <H2 id="storage">Where the keypair lives</H2>
      <UL>
        <li>The private key is generated locally and never leaves the node.</li>
        <li>It's sealed in the OS keystore (or, in containers, in an encrypted on-disk vault keyed by an installation secret).</li>
        <li>The public key + sealed identity certificate are stored in the local DB for fast boot.</li>
      </UL>

      <H2 id="example">Signing a control call</H2>
      <CodeBlock lang="ts" code={`const req = serializeMeshControlCall(payload);
const sig = await identity.sign(req); // Ed25519
mesh.send({ ...req, sig, nodeId: identity.publicKey });`} />

      <H2 id="failures">Failure modes</H2>
      <UL>
        <li><strong>Lost private key</strong> — node cannot rejoin; superadmin must revoke and re-bootstrap.</li>
        <li><strong>Revoked identity</strong> — the auth portal publishes a revocation list; peers reject signed calls from revoked node IDs.</li>
        <li><strong>Clock skew</strong> — signatures include a timestamp window; peers reject calls outside the window to prevent replay.</li>
      </UL>
    </article>
  ),
});
