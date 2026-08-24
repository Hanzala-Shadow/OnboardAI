import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("defines the OnboardAI workspace without starter metadata", async () => {
  const [workspace, layout] = await Promise.all([
    readFile(new URL("../app/workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /Three ways to test/);
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
  assert.match(workspace, /Open audit trail/);
});

test("produces the deployable worker and hosting manifest", async () => {
  await Promise.all([
    access(new URL("../dist/server/index.js", import.meta.url)),
    access(new URL("../dist/.openai/hosting.json", import.meta.url)),
    access(new URL("../dist/.openai/drizzle/0000_many_albert_cleary.sql", import.meta.url)),
  ]);
});
