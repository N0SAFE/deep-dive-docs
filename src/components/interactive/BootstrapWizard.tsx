"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

type Choice = "create" | "join" | null;
type Step = "intro" | "choice" | "auth" | "ready" | "joining" | "joined";

export function BootstrapWizard() {
  const [step, setStep] = useState<Step>("intro");
  const [choice, setChoice] = useState<Choice>(null);
  const [meshUrl, setMeshUrl] = useState("https://mesh.example.com");

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-border bg-surface/40">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-indigo-soft">First-run setup wizard</div>
        <div className="font-mono text-[11px] text-muted-foreground">root container · API + web</div>
      </div>
      <div className="p-6">
        <AnimatePresence mode="wait">
          {step === "intro" && (
            <Slide key="intro">
              <h4 className="font-display text-xl font-bold">Welcome to your node</h4>
              <p className="mt-2 text-muted-foreground">
                Only the API + web app containers are running. The mesh, scheduler, router, and event bus stay dormant
                until setup completes — that's the <em>required setup gate</em>.
              </p>
              <Btn onClick={() => setStep("choice")}>Begin setup</Btn>
            </Slide>
          )}
          {step === "choice" && (
            <Slide key="choice">
              <h4 className="font-display text-xl font-bold">Create or join a mesh?</h4>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Card onClick={() => { setChoice("create"); setStep("auth"); }} title="Create new mesh" sub="this server becomes the first node" active={choice==="create"} />
                <Card onClick={() => { setChoice("join"); setStep("joining"); }} title="Join existing mesh" sub="enter a known peer URL" active={choice==="join"} />
              </div>
            </Slide>
          )}
          {step === "joining" && (
            <Slide key="joining">
              <h4 className="font-display text-xl font-bold">Join an existing mesh</h4>
              <p className="mt-1 text-muted-foreground">Provide one peer URL. The node will discover the rest from there.</p>
              <input
                value={meshUrl}
                onChange={(e) => setMeshUrl(e.target.value)}
                className="mt-4 w-full rounded-md border border-border bg-[var(--code-bg)] px-3 py-2 font-mono text-sm"
              />
              <p className="mt-3 text-[12px] text-muted-foreground">
                URL gets persisted to local DB. On every restart the mesh module reads it back and reconnects automatically — no
                re-prompting.
              </p>
              <Btn onClick={() => setStep("auth")}>Connect</Btn>
            </Slide>
          )}
          {step === "auth" && (
            <Slide key="auth">
              <h4 className="font-display text-xl font-bold">Authenticate as superadmin</h4>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-[14px] text-foreground/85 marker:text-indigo-soft">
                <li>Node opens the mesh auth portal in a new tab.</li>
                <li>Superadmin signs in there.</li>
                <li>Portal returns the session to this node.</li>
                <li>Node creates a <strong>lifetime auth usage</strong> bound to that session.</li>
                <li>Lifetime usage is sealed with a generated <strong>public/private keypair</strong>.</li>
                <li>Future mesh control calls sign requests with the private key.</li>
              </ol>
              <Btn onClick={() => setStep("ready")}>Simulate sign-in</Btn>
            </Slide>
          )}
          {step === "ready" && (
            <Slide key="ready">
              <h4 className="font-display text-xl font-bold gradient-text">Setup complete</h4>
              <p className="mt-2 text-muted-foreground">
                The setup gate is now lifted. The orchestration layer launches the rest of the runtime containers.
                {choice === "join" && " The mesh module dials the saved peer URL and joins the topology."}
                {choice === "create" && " This node is the seed; further joiners use this URL."}
              </p>
              <div className="mt-4 rounded-lg border border-emerald/30 bg-emerald/10 p-3 font-mono text-[12px] text-emerald">
                ✓ identity sealed&nbsp;&nbsp;✓ peer URLs persisted&nbsp;&nbsp;✓ runtime containers launched
              </div>
              <Btn onClick={() => { setStep("intro"); setChoice(null); }}>Restart demo</Btn>
            </Slide>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Slide({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
      {children}
    </motion.div>
  );
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
      {children}
    </button>
  );
}

function Card({ onClick, title, sub, active }: { onClick: () => void; title: string; sub: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-xl border p-4 text-left transition " +
        (active ? "border-indigo/60 bg-indigo/10" : "border-border/60 bg-surface/60 hover:border-indigo/40")
      }
    >
      <div className="font-display text-[15px] font-semibold">{title}</div>
      <div className="mt-1 text-[12px] text-muted-foreground">{sub}</div>
    </button>
  );
}
