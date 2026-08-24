import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomAnalysis, sanitizeCustomRequest } from "../lib/custom.ts";

function request(overrides = {}) {
  return sanitizeCustomRequest({
    company: "Acme Analytics",
    contactEmail: "maya@acme.example",
    subject: "Reporting workspace onboarding",
    body: "Acme Analytics needs a reporting workspace with an implementation plan, kickoff scheduling, team access, and a welcome email. Jordan Lee is the approver.",
    ...overrides,
  });
}

test("extracts a detailed narrative across common business phrasing", () => {
  const analysis = buildCustomAnalysis(request({
    body: "Acme Analytics needs a new reporting workspace for 12 team members. Start on September 10 and deliver within six weeks. The budget is 900 USD per month. Jordan Lee is the approver. Billing: finance@acme.example. Client timezone is ET.",
  }));
  const fields = Object.fromEntries(analysis.fields.map((field) => [field.label, field.value]));
  assert.equal(analysis.canExecute, true);
  assert.equal(fields["Team seats"], "12");
  assert.equal(fields.Approver, "Jordan Lee");
  assert.match(fields.Budget, /900 USD per month/i);
  assert.match(fields.Kickoff, /September 10/i);
  assert.match(fields["Delivery target"], /six weeks/i);
  assert.equal(fields["Billing contact"], "finance@acme.example");
  assert.equal(fields["Client timezone"], "ET");
});

test("recognizes approver phrasing without relying on one template", () => {
  const variants = [
    "We need a customer-success workspace, task plan, kickoff schedule, and welcome pack for the implementation. Nadia Khan will approve.",
    "Please prepare the full onboarding workspace and implementation schedule for our product team. Approval should go through Elena Rossi.",
    "Goal: launch the agency portal. Setup: workspace, tasks, kickoff, and welcome email. Expected outcome: a reviewed onboarding plan. Approver: Aisha Malik.",
  ];
  for (const body of variants) {
    const analysis = buildCustomAnalysis(request({ body }));
    assert.equal(analysis.canExecute, true, body);
    assert.ok(analysis.fields.some((field) => field.label === "Approver"), body);
  }
});

test("safe-stops incomplete and malformed requests", () => {
  const analysis = buildCustomAnalysis(request({ company: "", contactEmail: "not-an-email", body: "Please make a workspace soon because the team needs it, but no owner or decision maker has been named and the scope is still unclear." }));
  assert.equal(analysis.canExecute, false);
  assert.deepEqual(analysis.actions, []);
  assert.ok(analysis.missing.includes("Client or company name"));
  assert.ok(analysis.missing.includes("Valid contact email"));
  assert.ok(analysis.missing.includes("Named human approver"));
  assert.match(analysis.clarificationDraft, /could you provide/i);
});

test("blocks credential-like data instead of processing it", () => {
  const analysis = buildCustomAnalysis(request({ body: "Prepare a complete onboarding workspace, access plan, kickoff schedule, and client welcome email. Jordan Lee is the approver. API key=abcd1234-secret." }));
  assert.equal(analysis.canExecute, false);
  assert.ok(analysis.missing.some((item) => item.includes("passwords")));
  assert.ok(analysis.policies.some((policy) => policy.label === "Sensitive-data check" && policy.status === "blocked"));
});

test("sanitizes excessive and irregular custom fields", () => {
  const sanitized = sanitizeCustomRequest({ company: `  ${"A".repeat(200)}  `, contactEmail: "  TEST@EXAMPLE.COM  ", subject: "  New   onboarding  ", body: "x".repeat(6000) });
  assert.equal(sanitized.company.length, 120);
  assert.equal(sanitized.contactEmail, "test@example.com");
  assert.equal(sanitized.subject, "New onboarding");
  assert.equal(sanitized.body.length, 5000);
});
