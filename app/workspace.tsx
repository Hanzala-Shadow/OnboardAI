"use client";

import { useMemo, useState } from "react";
import { scenarios, type PolicyCheck, type Scenario, type WorkflowAction } from "../lib/scenarios";

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
type CustomDraft = { company: string; contactEmail: string; subject: string; body: string };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const demoMeta = {
  northstar: { label: "Happy path", detail: "See a clear request become an approved plan.", recommended: true },
  copper: { label: "Review a warning", detail: "See policy warnings and a safe tool retry.", recommended: false },
  fieldnote: { label: "Safe stop", detail: "See missing information block every tool.", recommended: false },
} as const;

const journey = ["Choose a sample", "Review interpretation", "Approve or stop", "Watch execution", "Inspect evidence"];

function journeyIndex(phase: Phase) {
  if (phase === "idle") return 0;
  if (phase === "analyzing") return 1;
  if (phase === "review" || phase === "clarification" || phase === "rejected" || phase === "error") return 2;
  if (phase === "executing") return 3;
  return 4;
}

function guideFor(phase: Phase, company: string, custom: boolean) {
  if (phase === "idle") return { label: custom ? "Your request" : "Start here", title: custom ? "Paste a client request and test the agent" : `Analyze ${company}'s sample request`, body: custom ? "Use fictional or redacted information. The agent will interpret the text, apply policy, and show you what can safely happen next." : "The agent will extract facts and prepare a plan. You will review everything before any simulated action can run." };
  if (phase === "analyzing") return { label: "Agent working", title: "Turning the email into a reviewable plan", body: "The request is being interpreted, then checked against deterministic onboarding rules." };
  if (phase === "review") return { label: "Your decision", title: "Review what the simulation is allowed to do", body: "Check the extracted facts, warnings, and proposed actions. Approve only when the plan matches the request." };
  if (phase === "clarification") return { label: "Safe stop", title: "The agent found required information missing", body: "No tools are available. Copy the prepared clarification to see how the workflow recovers safely." };
  if (phase === "executing") return { label: "Approved simulation", title: "Watching each approved action run", body: "Only the actions you approved are being simulated. Progress and retries remain visible." };
  if (phase === "complete") return { label: "Evidence ready", title: "Inspect the proof of what happened", body: "Open the audit trail, then try the warning or safe-stop sample to test a different behavior." };
  if (phase === "rejected") return { label: "Stopped safely", title: "Your rejection prevented every action", body: "Nothing was simulated. Choose another sample or replay this one." };
  return { label: "Recovery", title: "The simulation paused without hiding prior work", body: "Review the preserved progress below, then replay the sample to try again." };
}

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
  const [customDraft, setCustomDraft] = useState<CustomDraft>({ company: "", contactEmail: "", subject: "", body: "" });

  const active = useMemo<Scenario>(() => selected === "custom" ? {
    id: "custom",
    company: customDraft.company || "Your client",
    contact: customDraft.contactEmail || "Custom request",
    email: customDraft.contactEmail || "No contact supplied",
    subject: customDraft.subject || "Your custom onboarding request",
    received: "Now",
    tone: "Custom",
    avatar: "+",
    body: [customDraft.body || "Paste a fictional or redacted client request below."],
    attachments: [],
    confidence: 0,
    canExecute: false,
    fields: [],
    missing: [],
    policies: [],
    actions: [],
  } : scenarios.find((item) => item.id === selected) ?? scenarios[0], [selected, customDraft]);
  const isCustom = selected === "custom";
  const customCanAnalyze = customDraft.body.trim().length >= 40;
  const completeActions = Object.values(actionStates).filter((state) => state === "complete").length;
  const currentStep = journeyIndex(phase);
  const guide = guideFor(phase, active.company, isCustom);

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
    setEngine(nextScenario === "custom" ? "custom_rules" : "verified_demo");
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
        body: JSON.stringify({ scenarioId: active.id, ...(isCustom ? { customRequest: customDraft } : {}) }),
      });
      const payload = await response.json() as { runId?: string; engine?: string; analysis?: Analysis; error?: string };
      if (!response.ok || !payload.runId || !payload.analysis) throw new Error(payload.error || "The request could not be analyzed");
      const remaining = 900 - (Date.now() - started);
      if (remaining > 0) await wait(remaining);
      setRunId(payload.runId);
      setEngine(payload.engine ?? "verified_demo");
      setAnalysis(payload.analysis);
      setActionStates(Object.fromEntries(payload.analysis.actions.map((action) => [action.id, "queued"])));
      setPhase(payload.analysis.canExecute ? "review" : "clarification");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request could not be analyzed");
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
      if (!approval.response.ok) throw new Error(approval.payload.error || "The approval could not be recorded");
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
          throw new Error(result.payload.error || `${action.tool} simulation failed`);
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
      setError(cause instanceof Error ? cause.message : "The simulation paused");
      setPhase("error");
    }
  }

  async function rejectPlan() {
    if (runId) await postExecution({ decision: "reject" }).catch(() => undefined);
    setPhase("rejected");
  }

  async function copyClarification() {
    if (!analysis?.clarificationDraft) return;
    await navigator.clipboard.writeText(analysis.clarificationDraft);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#demo" aria-label="OnboardAI guided demo"><span className="brand-mark" aria-hidden="true">O</span><span>Onboard<strong>AI</strong></span></a>
        <span className="demo-mode">Guided sandbox · about 3 minutes</span>
        <a className="text-link" href="https://github.com/Hanzala-Shadow/OnboardAI" target="_blank" rel="noreferrer">View source <span>↗</span></a>
      </header>

      <section className="product-intro" id="demo">
        <div>
          <p className="kicker">Client onboarding automation</p>
          <h1>Delegate the busywork.<br /><em>Keep the decision.</em></h1>
        </div>
        <div className="intro-copy">
          <p>See how an AI agent turns a messy client email into a policy-checked plan that a human must approve.</p>
          <div className="sandbox-notice"><span aria-hidden="true">✓</span><p><strong>Safe to explore</strong>No real emails, records, invitations, or calendar events are created.</p></div>
        </div>
      </section>

      <ol className="journey" aria-label="Demo progress">
        {journey.map((step, index) => <li className={index < currentStep ? "complete" : index === currentStep ? "current" : ""} aria-current={index === currentStep ? "step" : undefined} key={step}><span>{index < currentStep ? "✓" : index + 1}</span><strong>{step}</strong></li>)}
      </ol>

      <section className="demo-layout">
        <aside className="scenario-panel" aria-label="Choose a request">
          <div className="panel-heading"><div><p className="kicker">Choose a request</p><h2>Four ways to test</h2></div><span>01</span></div>
          <p className="panel-intro">Start with a proof scenario, then give the agent your own fictional or redacted request.</p>
          <div className="scenario-list">
            {scenarios.map((item) => {
              const meta = demoMeta[item.id as keyof typeof demoMeta];
              return <button className={`scenario ${selected === item.id ? "active" : ""}`} key={item.id} onClick={() => reset(item.id)} type="button" aria-pressed={selected === item.id}>
                <span className="scenario-top"><span className="avatar" aria-hidden="true">{item.avatar}</span><span className="scenario-name"><strong>{item.company}</strong><small>{item.subject}</small></span>{meta.recommended && <em>Recommended</em>}</span>
                <span className="scenario-outcome"><b>{meta.label}</b>{meta.detail}</span>
              </button>;
            })}
            <button className={`scenario custom-scenario ${isCustom ? "active" : ""}`} onClick={() => reset("custom")} type="button" aria-pressed={isCustom}>
              <span className="scenario-top"><span className="avatar custom-avatar" aria-hidden="true">+</span><span className="scenario-name"><strong>Try your own request</strong><small>Paste client onboarding text</small></span><em>Interactive</em></span>
              <span className="scenario-outcome"><b>Custom test</b>See what the agent extracts, blocks, and proposes.</span>
            </button>
          </div>
          <div className="demo-boundary"><span>Simulation boundary</span><p>AI interprets the request. Code enforces policy. Only your approval unlocks sandbox actions.</p></div>
        </aside>

        <section className="stage-shell" aria-busy={phase === "analyzing" || phase === "executing"}>
          <div className={`stage-guide ${phase}`} aria-live="polite">
            <div><span>{guide.label}</span><h2>{guide.title}</h2><p>{guide.body}</p></div>
            <strong>{String(currentStep + 1).padStart(2, "0")} / 05</strong>
          </div>

          <div className="stage-grid">
            <section className="request-panel">
              <div className="request-toolbar">
                <div><p className="kicker">{activeTab === "source" ? isCustom ? "Your client request" : "Sample client request" : "Review proposed plan"}</p><h2>{active.subject}</h2></div>
                {phase !== "idle" && <div className="view-tabs" role="tablist" aria-label="Request views"><button id="source-tab" aria-controls="source-panel" aria-selected={activeTab === "source"} className={activeTab === "source" ? "active" : ""} onClick={() => setActiveTab("source")} role="tab" type="button">Source</button><button id="review-tab" aria-controls="review-panel" aria-selected={activeTab === "review"} className={activeTab === "review" ? "active" : ""} onClick={() => setActiveTab("review")} role="tab" type="button">Agent review</button></div>}
              </div>

              <div id={activeTab === "source" ? "source-panel" : "review-panel"} role="tabpanel" aria-labelledby={activeTab === "source" ? "source-tab" : "review-tab"}>
                {activeTab === "source" ? isCustom ? <CustomRequestForm value={customDraft} onChange={setCustomDraft} locked={phase !== "idle"} /> : <SourceRequest scenario={active} /> : <AgentWorkspace phase={phase} analysis={analysis} actionStates={actionStates} artifacts={artifacts} error={error} engine={engine} onCopy={copyClarification} copied={copied} />}
              </div>

              <DecisionDock phase={phase} actionCount={analysis?.actions.length ?? 0} copied={copied} custom={isCustom} analyzeDisabled={isCustom && !customCanAnalyze} onAnalyze={runOnboarding} onApprove={approvePlan} onReject={rejectPlan} onCopy={copyClarification} onReplay={() => reset()} onAudit={() => setShowAudit(true)} onNext={() => reset(phase === "complete" ? "copper" : "northstar")} />
            </section>

            <ControlPanel phase={phase} analysis={analysis} actionStates={actionStates} completeActions={completeActions} artifacts={artifacts} engine={engine} />
          </div>
        </section>
      </section>

      <section className="proof-strip" aria-label="How safety is enforced">
        <div><span>Interpret</span><p>AI proposes facts for review.</p></div>
        <div><span>Guard</span><p>Code applies deterministic policy.</p></div>
        <div><span>Approve</span><p>A human unlocks the simulation.</p></div>
        <div><span>Verify</span><p>Every step leaves audit evidence.</p></div>
      </section>

      {showAudit && <AuditDrawer events={auditEvents} artifacts={artifacts} runId={runId} onClose={() => setShowAudit(false)} />}
    </main>
  );
}

function DecisionDock({ phase, actionCount, copied, custom, analyzeDisabled, onAnalyze, onApprove, onReject, onCopy, onReplay, onAudit, onNext }: { phase: Phase; actionCount: number; copied: boolean; custom: boolean; analyzeDisabled: boolean; onAnalyze: () => void; onApprove: () => void; onReject: () => void; onCopy: () => void; onReplay: () => void; onAudit: () => void; onNext: () => void }) {
  if (phase === "idle") return <div className="decision-dock"><div><span>Next step</span><strong>{custom ? "Let the agent interpret your request" : "Let the agent interpret this sample"}</strong><small>{analyzeDisabled ? "Add at least 40 characters of request detail." : "You will review the result before anything runs."}</small></div><button className="primary-action" onClick={onAnalyze} disabled={analyzeDisabled} type="button">Analyze this request <span>→</span></button></div>;
  if (phase === "analyzing") return <div className="decision-dock working" aria-live="polite"><div><span>In progress</span><strong>Reading source → extracting facts → checking rules</strong><small>No actions are unlocked during analysis.</small></div><div className="working-dots" aria-hidden="true"><i /><i /><i /></div></div>;
  if (phase === "review") return <div className="decision-dock review-dock"><div><span>Human approval required</span><strong>Approve {actionCount} sandbox actions</strong><small>Nothing has run yet. Rejecting keeps every tool locked.</small></div><div className="dock-actions"><button className="secondary-action" onClick={onReject} type="button">Reject safely</button><button className="primary-action" onClick={onApprove} type="button">Approve this simulation <span>→</span></button></div></div>;
  if (phase === "clarification") return <div className="decision-dock blocked-dock"><div><span>Agent stopped safely</span><strong>Send the prepared questions before onboarding</strong><small>Tool execution is unavailable until required information exists.</small></div><button className="primary-action" onClick={onCopy} type="button">{copied ? "Clarification copied ✓" : "Copy clarification"}</button></div>;
  if (phase === "executing") return <div className="decision-dock working" aria-live="polite"><div><span>Approved simulation</span><strong>Running one action at a time</strong><small>Provider retries and completed steps remain visible.</small></div><div className="working-dots" aria-hidden="true"><i /><i /><i /></div></div>;
  if (phase === "complete") return <div className="decision-dock complete-dock"><div><span>Run complete</span><strong>Evidence is ready for inspection</strong><small>Next, try a warning case to see human judgment and retry behavior.</small></div><div className="dock-actions"><button className="secondary-action" onClick={onNext} type="button">Try warning case</button><button className="primary-action" onClick={onAudit} type="button">Open audit trail <span>→</span></button></div></div>;
  return <div className="decision-dock"><div><span>{phase === "rejected" ? "Nothing was simulated" : "Simulation paused"}</span><strong>{phase === "rejected" ? "Choose another sample when ready" : "Prior progress is preserved above"}</strong><small>Replay starts a fresh, isolated sandbox run.</small></div><button className="primary-action" onClick={onReplay} type="button">Replay this sample <span>→</span></button></div>;
}

function CustomRequestForm({ value, onChange, locked }: { value: CustomDraft; onChange: (value: CustomDraft) => void; locked: boolean }) {
  function update(field: keyof CustomDraft, next: string) {
    onChange({ ...value, [field]: next });
  }

  return <form className="custom-form" aria-label="Custom client request" onSubmit={(event) => event.preventDefault()}>
    <div className="custom-privacy"><span aria-hidden="true">◇</span><p><strong>Use fictional or redacted information</strong>The original text is processed for this run but is not written to the audit database. Do not paste passwords, access keys, or confidential client data.</p></div>
    <div className="custom-fields">
      <label><span>Client or company</span><input value={value.company} onChange={(event) => update("company", event.target.value)} disabled={locked} maxLength={120} placeholder="Example: Atlas Studio" autoComplete="organization" /></label>
      <label><span>Contact email</span><input value={value.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} disabled={locked} maxLength={160} placeholder="client@example.com" type="email" autoComplete="email" /></label>
    </div>
    <label><span>Request subject</span><input value={value.subject} onChange={(event) => update("subject", event.target.value)} disabled={locked} maxLength={160} placeholder="Example: Set up our product launch workspace" /></label>
    <label><span>Paste the client request</span><textarea value={value.body} onChange={(event) => update("body", event.target.value)} disabled={locked} maxLength={5000} rows={11} aria-describedby="custom-request-help" placeholder="Include the goal, desired timing, requested setup, and a named approver. Example: We want to begin the website launch project on September 15. Please prepare a workspace and kickoff options. Jordan Lee is the approver..." /><small id="custom-request-help">{value.body.length}/5000 characters · 40 minimum to analyze</small></label>
    {locked && <p className="custom-lock-note">This input is locked for the current run so the source and audit evidence stay consistent.</p>}
  </form>;
}

function SourceRequest({ scenario }: { scenario: (typeof scenarios)[number] }) {
  return <article className="message-card"><div className="message-meta"><span className="avatar large" aria-hidden="true">{scenario.contact.charAt(0)}</span><div><strong>{scenario.contact}</strong><span>{scenario.email}</span></div><time>Today, 09:42</time></div><div className="message-body">{scenario.body.map((paragraph, index) => <p key={index}>{paragraph.split("\n").map((line, lineIndex) => <span key={lineIndex}>{line}{lineIndex < paragraph.split("\n").length - 1 && <br />}</span>)}</p>)}</div><div className="attachments">{scenario.attachments.map((file) => <div className="attachment" key={file.name}><span>{file.kind}</span><p><strong>{file.name}</strong><small>{file.size}</small></p><b>✓</b></div>)}</div></article>;
}

function AgentWorkspace({ phase, analysis, actionStates, artifacts, error, engine, onCopy, copied }: { phase: Phase; analysis: Analysis | null; actionStates: Record<string, ActionState>; artifacts: Artifact[]; error: string; engine: string; onCopy: () => void; copied: boolean }) {
  if (phase === "analyzing") return <div className="analysis-loading"><div className="analysis-symbol" aria-hidden="true"><span>01</span><i /></div><p className="kicker">Building a reviewable plan</p><h3>The agent is interpreting the request</h3><ul><li className="done">Reading the email and attachments</li><li className="active">Extracting client and project facts</li><li>Applying onboarding policy</li></ul></div>;
  if (!analysis && phase === "error") return <div className="outcome-state error-state"><span>!</span><p className="kicker">Analysis paused</p><h3>The request could not be interpreted</h3><p>{error}</p><small>No sandbox actions were unlocked.</small></div>;
  if (phase === "rejected") return <div className="outcome-state rejected-state"><span>×</span><p className="kicker">Human decision recorded</p><h3>The plan was rejected safely</h3><p>No client record, task, invitation, calendar hold, or email was simulated.</p></div>;
  if (!analysis) return null;
  if (phase === "clarification") return <div className="review-stack"><div className="review-head blocked"><div><p className="kicker">Execution unavailable</p><h3>{analysis.missing.length} required details are missing</h3></div><span>SAFE STOP</span></div><div className="missing-grid">{analysis.missing.map((item) => <div key={item}><span>!</span><p><strong>{item}</strong>Required before any onboarding action</p></div>)}</div><div className="draft-card"><div><p className="kicker">Prepared recovery</p><button onClick={onCopy} type="button">{copied ? "Copied ✓" : "Copy"}</button></div><pre>{analysis.clarificationDraft}</pre></div><PolicyGrid policies={analysis.policies} /></div>;
  if (phase === "complete") return <div className="outcome-state success-state"><span>✓</span><p className="kicker">Approved simulation complete</p><h3>Every action produced evidence</h3><p>The sandbox created traceable records without touching a real client system.</p><div className="artifact-grid">{artifacts.map((artifact) => <div key={artifact.externalId}><span>{artifact.tool}</span><strong>{artifact.title}</strong><code>{artifact.externalId}</code></div>)}</div></div>;

  return <div className="review-stack">{phase === "error" && <div className="inline-error"><strong>Simulation paused</strong><span>{error}</span><small>Completed evidence and the original plan remain visible.</small></div>}<div className="review-head"><div><p className="kicker">AI interpretation for review</p><h3>{analysis.fields.length} extracted facts</h3></div><span>{analysis.confidence}% confidence</span></div><div className="field-grid">{analysis.fields.map((field) => <div key={field.label}><span>{field.label}</span><strong>{field.value}</strong><small>Source: {field.source}</small></div>)}</div><PolicyGrid policies={analysis.policies} /><div className="action-plan"><div className="section-label"><span>Actions awaiting approval</span><strong>{analysis.actions.length}</strong></div>{analysis.actions.map((action) => { const state = actionStates[action.id] ?? "queued"; return <div className={`action-row ${state}`} key={action.id}><span className="action-state">{state === "complete" ? "✓" : state === "running" ? "↻" : state === "retrying" ? "↺" : state === "failed" ? "!" : "→"}</span><div><strong>{action.title}</strong><small>{action.detail}</small></div><em>{state === "queued" ? "Locked" : state === "retrying" ? "Safe retry" : state}</em></div>; })}</div><p className="model-note">{engine === "gemini_live" ? "AI extraction: Gemini · Policy and execution: deterministic code" : engine === "custom_rules" ? "Custom extraction: local structured parser · Policy and execution: deterministic code" : "AI extraction: verified demo dataset · Policy and execution: deterministic code"}</p></div>;
}

function PolicyGrid({ policies }: { policies: PolicyCheck[] }) {
  return <div className="policy-section"><div className="section-label"><span>Deterministic policy checks</span><strong>{policies.filter((item) => item.status === "pass").length}/{policies.length} passed</strong></div><div className="policy-grid">{policies.map((policy) => <div className={policy.status} key={policy.label}><span>{policy.status === "pass" ? "✓" : "!"}</span><p><strong>{policy.label}</strong>{policy.detail}</p></div>)}</div></div>;
}

function ControlPanel({ phase, analysis, actionStates, completeActions, artifacts, engine }: { phase: Phase; analysis: Analysis | null; actionStates: Record<string, ActionState>; completeActions: number; artifacts: Artifact[]; engine: string }) {
  const steps = [
    { title: "Interpretation", detail: analysis ? `${analysis.fields.length} facts proposed` : "Waiting for analysis", done: !!analysis },
    { title: "Policy", detail: analysis ? `${analysis.policies.length} rules checked` : "Deterministic controls", done: !!analysis },
    { title: "Human decision", detail: phase === "rejected" ? "Rejected" : phase === "clarification" ? "Blocked by policy" : ["executing", "complete", "error"].includes(phase) ? "Approved" : "Required", done: ["executing", "complete", "rejected", "clarification", "error"].includes(phase) },
    { title: "Sandbox actions", detail: analysis ? `${completeActions}/${analysis.actions.length} completed` : "Locked", done: phase === "complete" },
    { title: "Evidence", detail: artifacts.length ? `${artifacts.length} records available` : "Available after execution", done: phase === "complete" },
  ];
  const workingAction = analysis?.actions.find((action) => ["running", "retrying"].includes(actionStates[action.id]));
  return <aside className="control-panel" aria-label="Agent control and evidence"><div className="panel-heading"><div><p className="kicker">Control & evidence</p><h2>What remains locked</h2></div><span>02</span></div><div className="lock-card"><span aria-hidden="true">◆</span><p><strong>{phase === "executing" ? "Only approved actions are running" : phase === "complete" ? "The run is complete" : "All sandbox tools are locked"}</strong>{phase === "executing" ? workingAction?.title ?? "Preparing the next action" : phase === "complete" ? "Open the audit trail to inspect every step." : "Model output cannot call tools directly."}</p></div><ol className="control-steps">{steps.map((step, index) => <li className={step.done ? "done" : index === journeyIndex(phase) ? "active" : ""} key={step.title}><span>{step.done ? "✓" : index + 1}</span><p><strong>{step.title}</strong>{step.detail}</p></li>)}</ol><div className="evidence-card"><span>Evidence ledger</span><div><p>Completed actions<strong>{completeActions}</strong></p><p>Unsafe actions<strong>0</strong></p><p>External systems touched<strong>0</strong></p></div></div><p className="engine-note">Extraction source: {engine === "gemini_live" ? "Gemini live" : engine === "custom_rules" ? "local structured parser" : "verified demo data"}</p></aside>;
}

function AuditDrawer({ events, artifacts, runId, onClose }: { events: AuditEvent[]; artifacts: Artifact[]; runId: string | null; onClose: () => void }) {
  return <div className="audit-overlay" role="dialog" aria-modal="true" aria-label="Audit trail"><button className="audit-backdrop" onClick={onClose} aria-label="Close audit trail" type="button" /><aside className="audit-drawer"><div className="audit-header"><div><p className="kicker">Evidence ledger</p><h2>Audit trail</h2><code>{runId?.slice(0, 13)}…</code></div><button onClick={onClose} aria-label="Close audit trail" type="button">×</button></div><div className="audit-timeline">{events.map((event) => <div className={event.status} key={event.id}><span>{event.status === "complete" ? "✓" : event.status === "retrying" ? "↺" : "!"}</span><p><strong>{event.title}</strong>{event.detail}<small>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small></p></div>)}</div><div className="audit-footer"><div><span>Sandbox records</span><strong>{artifacts.length}</strong></div><div><span>Unsafe actions</span><strong>0</strong></div><p>This ledger is stored for the demo run. All external IDs are synthetic.</p></div></aside></div>;
}
