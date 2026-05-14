"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

type View = "overview" | "consumer" | "mesh" | "flow";

export function MeshConsumerBoundary() {
  const [view, setView] = useState<View>("overview");

  return (
    <div className="my-6 rounded-xl border border-border bg-surface/40 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-indigo-soft">
            Mesh-Consumer Boundary
          </div>
          <div className="text-[12px] text-muted-foreground">
            See how mesh runtime and feature modules stay separate
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[12px]">
          {(["overview", "consumer", "mesh", "flow"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={
                "rounded-md px-3 py-1 transition " +
                (view === v ? "bg-indigo/20 text-foreground" : "border border-border text-muted-foreground hover:text-foreground")
              }
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === "overview" && <OverviewView />}
        {view === "consumer" && <ConsumerView />}
        {view === "mesh" && <MeshView />}
        {view === "flow" && <FlowView />}
      </AnimatePresence>
    </div>
  );
}

function OverviewView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="space-y-4"
    >
      <svg viewBox="0 0 500 300" className="w-full grid-bg rounded-lg">
        {/* Consumer domain box */}
        <rect x="20" y="20" width="200" height="250" fill="none" stroke="oklch(0.78 0.16 195)" strokeWidth="2" strokeDasharray="5 5" rx="6" />
        <text x="30" y="40" fontSize="12" fontWeight="bold" fill="oklch(0.78 0.16 195)">
          Feature Module (Deployment)
        </text>

        {/* Controller */}
        <rect x="35" y="60" width="170" height="50" fill="oklch(0.22 0.04 282)" stroke="oklch(0.78 0.16 195)" strokeWidth="1.5" rx="4" />
        <text x="45" y="85" fontSize="11" fill="oklch(0.94 0.02 280)" fontFamily="var(--font-mono)">
          Consumer Controller
        </text>

        {/* Orchestrator */}
        <rect x="35" y="125" width="170" height="50" fill="oklch(0.22 0.04 282)" stroke="oklch(0.78 0.16 195)" strokeWidth="1.5" rx="4" />
        <text x="45" y="150" fontSize="11" fill="oklch(0.94 0.02 280)" fontFamily="var(--font-mono)">
          Stream Orchestrator
        </text>

        {/* Business Service */}
        <rect x="35" y="190" width="170" height="50" fill="oklch(0.22 0.04 282)" stroke="oklch(0.78 0.16 195)" strokeWidth="1.5" rx="4" />
        <text x="45" y="215" fontSize="11" fill="oklch(0.94 0.02 280)" fontFamily="var(--font-mono)">
          Business Service
        </text>

        {/* Arrows within consumer */}
        <path d="M 120 110 L 120 125" stroke="oklch(0.78 0.16 195)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
        <path d="M 120 175 L 120 190" stroke="oklch(0.78 0.16 195)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />

        {/* Mesh domain box */}
        <rect x="280" y="20" width="200" height="250" fill="none" stroke="oklch(0.66 0.21 282)" strokeWidth="2" strokeDasharray="5 5" rx="6" />
        <text x="290" y="40" fontSize="12" fontWeight="bold" fill="oklch(0.66 0.21 282)">
          Mesh Core Module
        </text>

        {/* Discovery */}
        <rect x="295" y="60" width="170" height="50" fill="oklch(0.22 0.04 282)" stroke="oklch(0.66 0.21 282)" strokeWidth="1.5" rx="4" />
        <text x="305" y="85" fontSize="11" fill="oklch(0.94 0.02 280)" fontFamily="var(--font-mono)">
          Resource Directory
        </text>

        {/* Connection Broker */}
        <rect x="295" y="125" width="170" height="50" fill="oklch(0.22 0.04 282)" stroke="oklch(0.66 0.21 282)" strokeWidth="1.5" rx="4" />
        <text x="305" y="150" fontSize="11" fill="oklch(0.94 0.02 280)" fontFamily="var(--font-mono)">
          Connection Broker
        </text>

        {/* Bridge Runtime */}
        <rect x="295" y="190" width="170" height="50" fill="oklch(0.22 0.04 282)" stroke="oklch(0.66 0.21 282)" strokeWidth="1.5" rx="4" />
        <text x="305" y="215" fontSize="11" fill="oklch(0.94 0.02 280)" fontFamily="var(--font-mono)">
          Bridge Runtime
        </text>

        {/* Arrows within mesh */}
        <path d="M 380 110 L 380 125" stroke="oklch(0.66 0.21 282)" strokeWidth="1.5" markerEnd="url(#arrowhead2)" />
        <path d="M 380 175 L 380 190" stroke="oklch(0.66 0.21 282)" strokeWidth="1.5" markerEnd="url(#arrowhead2)" />

        {/* Boundary crossing arrows */}
        <path d="M 220 145 L 280 145" stroke="oklch(0.78 0.13 282)" strokeWidth="2" markerEnd="url(#arrowhead3)" />
        <text x="240" y="135" fontSize="10" fill="oklch(0.78 0.13 282)" textAnchor="middle">
          public
        </text>

        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="oklch(0.78 0.16 195)" />
          </marker>
          <marker id="arrowhead2" markerWidth="10" markerHeight="10" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="oklch(0.66 0.21 282)" />
          </marker>
          <marker id="arrowhead3" markerWidth="10" markerHeight="10" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="oklch(0.78 0.13 282)" />
          </marker>
        </defs>
      </svg>

      <div className="mt-4 space-y-2 text-[13px] text-foreground/85">
        <p>
          The mesh-consumer boundary separates <strong>what changes for business reasons</strong> from{" "}
          <strong>what handles transport</strong>.
        </p>
        <p>
          Consumer modules (left) own domain logic. Mesh core (right) owns discovery and bridging. Click the tabs to see each side in detail.
        </p>
      </div>
    </motion.div>
  );
}

function ConsumerView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="space-y-3"
    >
      <div className="rounded-lg border border-teal/30 bg-teal/10 p-4">
        <div className="mb-2 font-display text-sm font-semibold text-teal">Feature Module Responsibilities</div>
        <ul className="space-y-1.5 text-[13px] text-foreground/85">
          <li>✓ Controller validates business input (auth, permissions)</li>
          <li>✓ Orchestrator decides: local ownership or remote stream?</li>
          <li>✓ Business Service interprets domain events + applies state transitions</li>
          <li>✓ Never touches: resource keys, connection details, bridge lifecycle</li>
        </ul>
      </div>

      <div className="text-[12px] text-muted-foreground">
        <strong>Example:</strong> A Deployment controller handles "user wants to see deployment logs". The orchestrator checks
        ownership. If remote, it asks mesh. If local, the business service streams them directly. The controller never knows
        whether data came across a network.
      </div>
    </motion.div>
  );
}

function MeshView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="space-y-3"
    >
      <div className="rounded-lg border border-indigo/30 bg-indigo/10 p-4">
        <div className="mb-2 font-display text-sm font-semibold text-indigo">Mesh Core Responsibilities</div>
        <ul className="space-y-1.5 text-[13px] text-foreground/85">
          <li>✓ Resource Directory: where does this stream live?</li>
          <li>✓ Connection Broker: open SSE/HTTP/WebSocket to remote node</li>
          <li>✓ Bridge Runtime: proxy frames, handle backpressure, manage lifecycle</li>
          <li>✓ Never touches: business logic, domain event interpretation, permissions</li>
        </ul>
      </div>

      <div className="text-[12px] text-muted-foreground">
        <strong>Example:</strong> Mesh discovers "stream:deployment:abc lives on node-b". Opens a connection. Returns a typed
        observable. If the remote node dies, mesh handles reconnect logic. The feature module just keeps consuming.
      </div>
    </motion.div>
  );
}

function FlowView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="space-y-3"
    >
      <div className="space-y-2">
        <div className="text-[12px] font-semibold text-indigo-soft">Request: Get deployment logs</div>
        <ol className="space-y-2 text-[12px] text-foreground/85">
          <li className="flex gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo/20 text-[10px] font-mono">
              1
            </span>
            <span>
              <strong>Controller:</strong> validates user + checks permission to read logs
            </span>
          </li>
          <li className="flex gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo/20 text-[10px] font-mono">
              2
            </span>
            <span>
              <strong>Orchestrator:</strong> asks mesh "where do logs for deployment-123 live?"
            </span>
          </li>
          <li className="flex gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo/20 text-[10px] font-mono">
              3
            </span>
            <span>
              <strong>Mesh:</strong> looks up owner node, opens connection, returns observable
            </span>
          </li>
          <li className="flex gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo/20 text-[10px] font-mono">
              4
            </span>
            <span>
              <strong>Orchestrator:</strong> pipes observable to consumer (local or remote, same API)
            </span>
          </li>
          <li className="flex gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo/20 text-[10px] font-mono">
              5
            </span>
            <span>
              <strong>Controller:</strong> returns SSE stream to client, no transport details leaked
            </span>
          </li>
        </ol>
      </div>
    </motion.div>
  );
}
