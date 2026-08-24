"use client";

import { useMemo, useState } from "react";
import { scenarios, type PolicyCheck, type WorkflowAction } from "../lib/scenarios";

type Phase = "idle" | "analyzing" | "review" | "clarification" | "executing" | "complete" | "rejected" | "error";
type ActionState = "queued" | "running" | "retrying" | "complete" | "failed";
type Analysis = {
  confidence: number;
  canExecute: boolean;
  fields: { label: string; value: string; source: string }[];
  missing: string[];
  policies: PolicyCheck[];
  actions: WorkflowAction[];
  clarificationDraft?: string;
};
type Artifact = { actionId: string; tool: string; externalId: string; title: string };
type AuditEvent = { id: number; kind: string; title: string; detail: string; status: string; createdAt: string };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function OnboardWorkspace() {
  const [selected, setSelected] = useState("northstar");
  const [phase, setPhase] = useState<Phase>("idle");
  const [activeTab, setActiveTab] = useState<"source" | "review">("source");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [engine, setEngine] = useState("verified_demo");
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const active = useMemo(() => scenarios.find((item) => item.id === selected) ?? scenarios[0], [selected]);
  const minutesSaved = analysis?.actions.reduce((sum, action) => sum + action.minutesSaved, 0) ?? 0;
  const completeActions = Object.values(actionStates).filter((state) => state === "complete").length;

  function reset(nextScenario = selected) {
    setSelected(nextScenario);
    setPhase("idle");
    setActiveTab("source");
    setAnalysis(null);
    setRunId(null);
    setActionStates({});
    setArtifacts([]);
    setAuditEvents([]);
    setError("");
    setCopied(false);
  }

  async function runOnboarding() {
    setPhase("analyzing");
    setActiveTab("review");
    setError("");
    const started = Date.now();
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: active.id }),
      });
      const payload = await response.json() as { runId?: string; engine?: string; analysis?: Analysis; error?: string };
      if (!response.ok || !payload.runId || !payload.analysis) throw new Error(payload.error || "The workflow could not be analyzed");
      const remaining = 900 - (Date.now() - started);
      if (remaining > 0) await wait(remaining);
      setRunId(payload.runId);
      setEngine(payload.engine ?? "verified_demo");
      setAnalysis(payload.analysis);
      setActionStates(Object.fromEntries(payload.analysis.actions.map((action) => [action.id, "queued"])));
      setPhase(payload.analysis.canExecute ? "review" : "clarification");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The workflow could not be analyzed");
      setPhase("error");
    }
  }

  async function postExecution(body: Record<string, string>) {
    const response = await fetch("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId, scenarioId: active.id, ...body }),
    });
    const payload = await response.json() as { error?: string; retryable?: boolean; artifact?: Artifact };
    return { response, payload };
  }

  async function approvePlan() {
    if (!runId || !analysis) return;
    setPhase("executing");
    try {
      const approval = await postExecution({ decision: "approve" });
      if (!approval.response.ok) throw new Error(approval.payload.error || "Approval failed");
      for (const action of analysis.actions) {
        setActionStates((current) => ({ ...current, [action.id]: "running" }));
        await wait(280);
        let result = await postExecution({ actionId: action.id });
        if (!result.response.ok && result.payload.retryable) {
          setActionStates((current) => ({ ...current, [action.id]: "retrying" }));
          await wait(700);
          result = await postExecution({ actionId: action.id });
        }
        if (!result.response.ok || !result.payload.artifact) {
          setActionStates((current) => ({ ...current, [action.id]: "failed" }));
          throw new Error(result.payload.error || `${action.tool} action failed`);
        }
        setArtifacts((current) => [...current, result.payload.artifact as Artifact]);
        setActionStates((current) => ({ ...current, [action.id]: "complete" }));
      }
      const completion = await postExecution({ decision: "complete" });
      if (!completion.response.ok) throw new Error(completion.payload.error || "Completion could not be recorded");
      const auditResponse = await fetch(`/api/audit?runId=${encodeURIComponent(runId)}`);
      const auditPayload = await auditResponse.json() as { events?: AuditEvent[] };
      setAuditEvents(auditPayload.events ?? []);
      setPhase("complete");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Execution failed");
      setPhase("error");
    }
  }

  async function rejectPlan() {
    if (!runId) return;
    try {
      await postExecution({ decision: "reject" });
      setPhase("rejected");
    } catch {
      setPhase("rejected");
    }
  }

  async function copyClarification() {
    if (!analysis?.clarificationDraft) return;
    await navigator.clipboard.writeText(analysis.clarificationDraft);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const stateLabel = phase === "idle" ? "System ready" : phase === "analyzing" ? "Interpreting request" : phase === "executing" ? "Tools running" : phase === "complete" ? "Run complete" : phase === "clarification" ? "Clarification required" : "Human review";

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#workspace" aria-label="OnboardAI home"><span className="brand-mark" aria-hidden="true">O</span><span>Onboard<span>AI</span></span></a>
        <div className="topbar-center"><span className="eyebrow">Client operations</span><span className="divider" aria-hidden="true" /><span className="system-state"><i /> {stateLabel}</span></div>
        <a className="text-link" href="#how-it-works">How it works <span>↗</span></a>
      </header>

      <section className="workspace" id="workspace">
        <aside className="inbox-panel" aria-label="Sample client requests">
          <div className="panel-heading"><div><p className="kicker">Demo inbox</p><h1>Client requests</h1></div><span className="count">3</span></div>
          <div className="scenario-list">
            {scenarios.map((item) => (
              <button className={`scenario ${selected === item.id ? "active" : ""}`} key={item.id} onClick={() => reset(item.id)} type="button">
                <span className="avatar" aria-hidden="true">{item.avatar}</span>
                <span className="scenario-copy"><span className="scenario-row"><strong>{item.company}</strong><small>{item.received}</small></span><span>{item.subject}</span><em className="tag">{item.tone}</em></span>
              </button>
            ))}
          </div>
          <div className="privacy-note"><span aria-hidden="true">◇</span><p><strong>Safe demo environment</strong>All names, documents, and actions are synthetic.</p></div>
        </aside>

        <section className="request-panel">
          <div className="request-toolbar">
            <div><p className="kicker">{activeTab === "source" ? "Incoming request" : "Agent workspace"}</p><h2>{active.subject}</h2></div>
            {phase !== "idle" && <div className="view-tabs" role="tablist" aria-label="Request views"><button className={activeTab === "source" ? "active" : ""} onClick={() => setActiveTab("source")} role="tab" type="button">Source</button><button className={activeTab === "review" ? "active" : ""} onClick={() => setActiveTab("review")} role="tab" type="button">Review</button></div>}
          </div>

          {activeTab === "source" ? <SourceRequest scenario={active} /> : (
            <AgentWorkspace phase={phase} analysis={analysis} actionStates={actionStates} artifacts={artifacts} error={error} engine={engine} onCopy={copyClarification} copied={copied} />
          )}

          {phase === "idle" && <button className="primary-action" onClick={runOnboarding} type="button"><span className="spark" aria-hidden="true">✦</span>Run onboarding<small>AI plans. You approve.</small><span className="arrow" aria-hidden="true">→</span></button>}
          {phase === "review" && <div className="approval-bar"><div><span>Human checkpoint</span><strong>Review {analysis?.actions.length} proposed actions</strong></div><button className="reject-button" onClick={rejectPlan} type="button">Reject</button><button className="approve-button" onClick={approvePlan} type="button">Approve & run <span>→</span></button></div>}
          {phase === "clarification" && <div className="approval-bar blocked-bar"><div><span>Safe stop</span><strong>Required data must be supplied first</strong></div><button className="approve-button" onClick={copyClarification} type="button">{copied ? "Copied" : "Copy clarification"}</button></div>}
          {(phase === "complete" || phase === "rejected" || phase === "error") && <div className="completion-actions"><button className="secondary-action" onClick={() => reset()} type="button">Replay workflow</button>{phase === "complete" && <button className="approve-button" onClick={() => setShowAudit(true)} type="button">View audit trail <span>→</span></button>}</div>}
        </section>

        <RunPanel phase={phase} analysis={analysis} completeActions={completeActions} minutesSaved={minutesSaved} engine={engine} />
      </section>

      <section className="trust-strip" id="how-it-works">
        <div><span>01</span><p><strong>Interpret</strong>Unstructured requests become validated data.</p></div>
        <div><span>02</span><p><strong>Check</strong>Policy controls block unsafe actions.</p></div>
        <div><span>03</span><p><strong>Approve</strong>A human reviews every proposed change.</p></div>
        <div><span>04</span><p><strong>Execute</strong>Tools run with a complete audit trail.</p></div>
      </section>

      {showAudit && <AuditDrawer events={auditEvents} artifacts={artifacts} runId={runId} onClose={() => setShowAudit(false)} />}
    </main>
  );
}

function SourceRequest({ scenario }: { scenario: (typeof scenarios)[number] }) {
  return <article className="message-card">
    <div className="message-meta"><span className="avatar large" aria-hidden="true">{scenario.contact.charAt(0)}</span><div><strong>{scenario.contact}</strong><span>{scenario.email}</span></div><time>Today, 09:42</time></div>
    <div className="message-body">{scenario.body.map((paragraph, index) => <p key={index}>{paragraph.split("\n").map((line, lineIndex) => <span key={lineIndex}>{line}{lineIndex < paragraph.split("\n").length - 1 && <br />}</span>)}</p>)}</div>
    <div className="attachments">{scenario.attachments.map((file) => <div className="attachment" key={file.name}><span>{file.kind}</span><p><strong>{file.name}</strong><small>{file.size}</small></p><b>✓</b></div>)}</div>
  </article>;
}

function AgentWorkspace({ phase, analysis, actionStates, artifacts, error, engine, onCopy, copied }: { phase: Phase; analysis: Analysis | null; actionStates: Record<string, ActionState>; artifacts: Artifact[]; error: string; engine: string; onCopy: () => void; copied: boolean }) {
  if (phase === "analyzing") return <div className="analysis-loading"><div className="scan-orb"><span>✦</span></div><p className="kicker">Structured analysis</p><h3>Interpreting the request</h3><p>Extracting facts, checking onboarding policy, and preparing tool-safe actions.</p><div className="loading-lines"><i /><i /><i /></div></div>;
  if (phase === "error") return <div className="outcome-state error-state"><span>!</span><p className="kicker">Workflow paused</p><h3>Something needs attention</h3><p>{error}</p><small>No further tools were called.</small></div>;
  if (phase === "rejected") return <div className="outcome-state rejected-state"><span>×</span><p className="kicker">Human decision recorded</p><h3>Plan rejected safely</h3><p>The reviewer stopped this run before execution. No client record, task, invitation, calendar hold, or email was created.</p></div>;
  if (!analysis) return null;
  if (phase === "clarification") return <div className="review-stack"><div className="review-head blocked"><div><p className="kicker">Execution blocked</p><h3>{analysis.missing.length} required details are missing</h3></div><span>SAFE STOP</span></div><div className="missing-grid">{analysis.missing.map((item) => <div key={item}><span>!</span><p><strong>{item}</strong>Required by onboarding policy</p></div>)}</div><div className="draft-card"><div><p className="kicker">Prepared response</p><button onClick={onCopy} type="button">{copied ? "Copied ✓" : "Copy"}</button></div><pre>{analysis.clarificationDraft}</pre></div><PolicyGrid policies={analysis.policies} /></div>;
  if (phase === "complete") return <div className="outcome-state success-state"><span>✓</span><p className="kicker">Workflow complete</p><h3>Client onboarding is ready</h3><p>Every approved tool action completed and produced a traceable sandbox record.</p><div className="artifact-grid">{artifacts.map((artifact) => <div key={artifact.externalId}><span>{artifact.tool}</span><strong>{artifact.title}</strong><code>{artifact.externalId}</code></div>)}</div></div>;

  return <div className="review-stack">
    <div className="review-head"><div><p className="kicker">Structured extraction</p><h3>{analysis.fields.length} facts ready for review</h3></div><span>{engine === "gemini_live" ? "GEMINI LIVE" : "VERIFIED DEMO"}</span></div>
    <div className="field-grid">{analysis.fields.map((field) => <div key={field.label}><span>{field.label}</span><strong>{field.value}</strong><small>{field.source}</small></div>)}</div>
    <PolicyGrid policies={analysis.policies} />
    <div className="action-plan"><div className="section-label"><span>Proposed tool actions</span><strong>{analysis.actions.length}</strong></div>{analysis.actions.map((action) => { const state = actionStates[action.id] ?? "queued"; return <div className={`action-row ${state}`} key={action.id}><span className="action-state">{state === "complete" ? "✓" : state === "running" ? "↻" : state === "retrying" ? "↺" : "→"}</span><div><strong>{action.title}</strong><small>{action.detail}</small></div><em>{state === "retrying" ? "retrying" : action.tool}</em></div>; })}</div>
  </div>;
}

function PolicyGrid({ policies }: { policies: PolicyCheck[] }) {
  return <div className="policy-section"><div className="section-label"><span>Policy controls</span><strong>{policies.filter((item) => item.status === "pass").length}/{policies.length} passed</strong></div><div className="policy-grid">{policies.map((policy) => <div className={policy.status} key={policy.label}><span>{policy.status === "pass" ? "✓" : "!"}</span><p><strong>{policy.label}</strong>{policy.detail}</p></div>)}</div></div>;
}

function RunPanel({ phase, analysis, completeActions, minutesSaved, engine }: { phase: Phase; analysis: Analysis | null; completeActions: number; minutesSaved: number; engine: string }) {
  const hasAnalysis = !!analysis;
  const approved = phase === "executing" || phase === "complete";
  const steps = [
    { title: "Request interpreted", detail: hasAnalysis ? `${analysis.fields.length} structured fields` : "Waiting to start", state: hasAnalysis ? "complete" : phase === "analyzing" ? "active" : "pending" },
    { title: "Policy evaluated", detail: hasAnalysis ? `${analysis.policies.length} controls checked` : "Deterministic rules", state: hasAnalysis ? "complete" : "pending" },
    { title: analysis?.canExecute === false ? "Safe stop prepared" : "Plan prepared", detail: hasAnalysis ? `${analysis.actions.length} actions proposed` : "Tools remain locked", state: hasAnalysis ? "complete" : "pending" },
    { title: "Human approval", detail: approved ? "Approved" : phase === "review" ? "Waiting for reviewer" : phase === "clarification" ? "Not permitted" : "Required before execution", state: approved ? "complete" : phase === "review" ? "active" : "pending" },
    { title: "Tool execution", detail: phase === "complete" ? `${completeActions} actions complete` : phase === "executing" ? `${completeActions}/${analysis?.actions.length ?? 0} complete` : "No mutations yet", state: phase === "complete" ? "complete" : phase === "executing" ? "active" : "pending" },
  ];
  return <aside className="run-panel" aria-label="Workflow status">
    <div className="run-heading"><div><p className="kicker">Run control</p><h2>Workflow trace</h2></div><span className="run-id">{phase === "idle" ? "READY" : "ACTIVE"}</span></div>
    <div className="engine-card"><span>Extraction engine</span><strong>{engine === "gemini_live" ? "Gemini live" : "Verified demo dataset"}</strong><small>{engine === "gemini_live" ? "Model extracts; code controls actions" : "Stable fallback until API key is connected"}</small></div>
    {analysis && <div className="confidence-row"><div><span>Extraction confidence</span><strong>{analysis.confidence}%</strong></div><div className="confidence-track"><i style={{ width: `${analysis.confidence}%` }} /></div></div>}
    <ol className="step-list">{steps.map((step, index) => <li className={step.state} key={step.title}><span className="step-number">{step.state === "complete" ? "✓" : String(index + 1).padStart(2, "0")}</span><div><strong>{step.title}</strong><small>{step.detail}</small></div></li>)}</ol>
    <div className="summary-card"><div><span>Estimated time saved</span><strong>{minutesSaved || 34} min</strong></div><div><span>Completed actions</span><strong>{completeActions}</strong></div><div><span>Unapproved actions</span><strong>{approved || phase === "complete" ? 0 : analysis?.actions.length ?? 0}</strong></div></div>
    <div className="guardrail"><span>◆</span><p><strong>No action runs without approval.</strong>Model output cannot bypass policy or call tools directly.</p></div>
  </aside>;
}

function AuditDrawer({ events, artifacts, runId, onClose }: { events: AuditEvent[]; artifacts: Artifact[]; runId: string | null; onClose: () => void }) {
  return <div className="audit-overlay" role="dialog" aria-modal="true" aria-label="Audit trail"><button className="audit-backdrop" onClick={onClose} aria-label="Close audit trail" type="button" /><aside className="audit-drawer"><div className="audit-header"><div><p className="kicker">Immutable run record</p><h2>Audit trail</h2><code>{runId?.slice(0, 13)}…</code></div><button onClick={onClose} aria-label="Close" type="button">×</button></div><div className="audit-timeline">{events.map((event) => <div className={event.status} key={event.id}><span>{event.status === "complete" ? "✓" : event.status === "retrying" ? "↺" : "!"}</span><p><strong>{event.title}</strong>{event.detail}<small>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small></p></div>)}</div><div className="audit-footer"><div><span>Tool records</span><strong>{artifacts.length}</strong></div><div><span>Unsafe actions</span><strong>0</strong></div><p>Synthetic demonstration data. No external email, invite, or calendar event was sent.</p></div></aside></div>;
}
