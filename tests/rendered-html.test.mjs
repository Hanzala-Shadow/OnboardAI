import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("defines the OnboardAI workspace without starter metadata", async () => {
  const [workspace, layout] = await Promise.all([
    readFile(new URL("../app/workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /Four ways to test/);
  assert.match(workspace, /Analyze this request/);
  assert.match(workspace, /Safe to explore/);
  assert.match(workspace, /aria-current/);
  assert.match(workspace, /aria-busy/);
  assert.match(layout, /OnboardAI — From request to approved workflow/);
  assert.doesNotMatch(layout, /codex-preview/);
  assert.doesNotMatch(workspace, /Starter Project/);
});

test("defines the portfolio embed route", async () => {
  const embed = await readFile(new URL("../app/embed/page.tsx", import.meta.url), "utf8");
  assert.match(embed, /Trustworthy client operations/);
  assert.match(embed, /Open live workflow/);
});

test("defines a guided agent supervision flow", async () => {
  const workspace = await readFile(new URL("../app/workspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /Happy path/);
  assert.match(workspace, /Review a warning/);
  assert.match(workspace, /Safe stop/);
  assert.match(workspace, /Approve this simulation/);
  assert.match(workspace, /View proof of execution/);
});

test("renders a tangible client workspace with explicit readiness gaps", async () => {
  const workspace = await readFile(new URL("../app/workspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /Generated client workspace/);
  assert.match(workspace, /Client profile/);
  assert.match(workspace, /Missing and incomplete information/);
  assert.match(workspace, /Onboarding task board/);
  assert.match(workspace, /Kickoff options/);
  assert.match(workspace, /Welcome email/);
  assert.match(workspace, /Decision and policy history/);
  assert.match(workspace, /Created sandbox records/);
  assert.match(workspace, /Required before live handoff/);
  assert.match(workspace, /Nothing was invited or reserved/);
});

test("explains audit evidence for nontechnical reviewers", async () => {
  const workspace = await readFile(new URL("../app/workspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /Proof of execution/);
  assert.match(workspace, /What happened and why/);
  assert.match(workspace, /What this proves/);
  assert.match(workspace, /The agent could not act alone/);
  assert.match(workspace, /Copy proof summary/);
  assert.match(workspace, /View technical run details/);
});

test("defines a custom request path with privacy and policy gates", async () => {
  const [workspace, analyze, execute, custom] = await Promise.all([
    readFile(new URL("../app/workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/analyze/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/execute/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/custom.ts", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /Try your own request/);
  assert.match(workspace, /Use fictional or redacted information/);
  assert.match(workspace, /not written to the audit database/);
  assert.match(analyze, /sanitizeCustomRequest/);
  assert.match(custom, /Named approver/);
  assert.match(custom, /actions: canExecute \? customActions : \[\]/);
  assert.match(execute, /run\.status !== "review"/);
  assert.match(execute, /run\.status !== "executing"/);
});

test("produces the deployable worker and hosting manifest", async () => {
  await Promise.all([
    access(new URL("../dist/server/index.js", import.meta.url)),
    access(new URL("../dist/.openai/hosting.json", import.meta.url)),
    access(new URL("../dist/.openai/drizzle/0000_many_albert_cleary.sql", import.meta.url)),
  ]);
});
