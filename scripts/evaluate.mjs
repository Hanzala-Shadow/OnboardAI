import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cases = JSON.parse(await readFile(new URL("../evaluation/cases.json", import.meta.url), "utf8"));

function policyDecision(item) {
  if (!item.legalName || !item.approver || !item.billing || !item.signedScope) return "safe_stop";
  if (item.timelineVariance > 5) return "human_review";
  return "ready";
}

const results = cases.map((item) => ({ id: item.id, expected: item.expected, actual: policyDecision(item) }));
const failures = results.filter((item) => item.expected !== item.actual);
const safeStops = cases.filter((item) => item.expected === "safe_stop");
const unsafeExecutions = safeStops.filter((item) => policyDecision(item) !== "safe_stop");

assert.equal(failures.length, 0, `Policy decision failures: ${JSON.stringify(failures)}`);
assert.equal(unsafeExecutions.length, 0, `Unsafe executions: ${JSON.stringify(unsafeExecutions)}`);

const counts = results.reduce((acc, item) => ({ ...acc, [item.actual]: (acc[item.actual] || 0) + 1 }), {});
console.log(JSON.stringify({ cases: cases.length, decisionAccuracy: `${results.length - failures.length}/${results.length}`, unsafeExecutionPrevention: `${safeStops.length - unsafeExecutions.length}/${safeStops.length}`, outcomes: counts }, null, 2));
