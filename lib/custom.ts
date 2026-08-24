import type { PolicyCheck, Scenario, WorkflowAction } from "./scenarios";

export type CustomRequest = {
  company: string;
  contactEmail: string;
  subject: string;
  body: string;
};

type ExtractedField = { label: string; value: string; source: string };

const customActions: WorkflowAction[] = [
  { id: "custom-crm", tool: "CRM", title: "Prepare client record", detail: "Use the reviewed client identity and contact", minutesSaved: 5, risk: "low" },
  { id: "custom-workspace", tool: "Projects", title: "Prepare project workspace", detail: "Create a sandbox workspace from the interpreted scope", minutesSaved: 7, risk: "low" },
  { id: "custom-tasks", tool: "Projects", title: "Draft onboarding task plan", detail: "Create owners, checkpoints, and suggested due dates", minutesSaved: 9, risk: "review" },
  { id: "custom-calendar", tool: "Calendar", title: "Draft kickoff options", detail: "Prepare scheduling options without sending invitations", minutesSaved: 4, risk: "review" },
  { id: "custom-email", tool: "Email", title: "Draft client welcome message", detail: "Summarize the plan, owners, and next steps", minutesSaved: 4, risk: "review" },
];

export const customScenario: Scenario = {
  id: "custom",
  company: "Visitor-supplied client",
  contact: "Custom request",
  email: "redacted@example.com",
  subject: "Custom onboarding request",
  received: "Now",
  tone: "Custom",
  avatar: "+",
  body: ["Visitor-supplied request. Original text is processed for this run and is not stored in the audit database."],
  attachments: [],
  confidence: 78,
  canExecute: true,
  fields: [],
  missing: [],
  policies: [],
  actions: customActions,
};

function compact(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function sanitizeCustomRequest(input: Partial<CustomRequest>): CustomRequest {
  return {
    company: compact(input.company ?? "", 120),
    contactEmail: compact(input.contactEmail ?? "", 160).toLowerCase(),
    subject: compact(input.subject ?? "", 160),
    body: (input.body ?? "").trim().slice(0, 5000),
  };
}

function firstMatch(value: string, expression: RegExp) {
  return value.match(expression)?.[1]?.trim();
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function buildCustomAnalysis(request: CustomRequest, liveFields?: ExtractedField[] | null) {
  const text = `${request.subject}\n${request.body}`;
  const approver = firstMatch(text, /(?:approver|approved by|approval from|sign[- ]?off from)\s*(?:is|:|-)?\s*([A-Za-z][A-Za-z .'-]{2,60})/i);
  const billingEmail = firstMatch(text, /(?:billing|finance|accounts payable)(?:\s+contact)?(?:\s+is|\s*:)?\s*([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/i);
  const budget = firstMatch(text, /((?:USD|EUR|GBP|PKR|\$|€|£)\s?[\d,.]+(?:\s?(?:k|K|thousand))?)/);
  const start = firstMatch(text, /(?:start|kickoff|begin|launch)(?:\s+on|\s+by|\s*:|\s+date is)?\s+([^,.\n]{3,36})/i);
  const seats = firstMatch(text, /(?:invite|add|create accounts? for|team of)\s+(\d{1,3})/i);
  const requestType = firstMatch(text, /(?:project|workspace|campaign|redesign|sprint|implementation|onboarding)\s*(?:is|:|-)?\s*([^,.\n]{3,70})/i);

  const fields: ExtractedField[] = liveFields?.length ? liveFields : [
    request.company && { label: "Client", value: request.company, source: "Custom field" },
    request.contactEmail && { label: "Contact", value: request.contactEmail, source: "Custom field" },
    request.subject && { label: "Request", value: request.subject, source: "Subject" },
    requestType && { label: "Scope signal", value: titleCase(requestType), source: "Request text" },
    start && { label: "Timing signal", value: start, source: "Request text" },
    budget && { label: "Budget signal", value: budget, source: "Request text" },
    seats && { label: "Team seats", value: seats, source: "Request text" },
    approver && { label: "Approver", value: approver, source: "Request text" },
  ].filter((field): field is ExtractedField => Boolean(field));

  const hasCompany = request.company.length >= 2;
  const hasContact = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.contactEmail);
  const hasScope = request.body.replace(/\s+/g, " ").length >= 80;
  const hasApprover = Boolean(approver);
  const policies: PolicyCheck[] = [
    { label: "Client identity", detail: hasCompany ? `${request.company} is identified` : "A client or company name is required", status: hasCompany ? "pass" : "blocked" },
    { label: "Contact channel", detail: hasContact ? "A valid contact email is available" : "A valid contact email is required", status: hasContact ? "pass" : "blocked" },
    { label: "Request scope", detail: hasScope ? "Enough detail exists to prepare a plan" : "Add the goal, timing, and requested setup", status: hasScope ? "pass" : "blocked" },
    { label: "Named approver", detail: hasApprover ? `${approver} can review consequential actions` : "Name an approver in the request before execution", status: hasApprover ? "pass" : "blocked" },
    { label: "Billing readiness", detail: billingEmail ? `Billing contact detected: ${billingEmail}` : "No billing contact detected; review before a real implementation", status: billingEmail ? "pass" : "warning" },
  ];
  const missing = [
    !hasCompany && "Client or company name",
    !hasContact && "Valid contact email",
    !hasScope && "Clear project goal, timing, and requested setup",
    !hasApprover && "Named human approver",
  ].filter((item): item is string => Boolean(item));
  const canExecute = missing.length === 0;
  const clarificationDraft = canExecute ? undefined : [
    "Hello,",
    "",
    "Thanks for the onboarding request. Before we prepare the workspace, could you provide:",
    ...missing.map((item) => `- ${item}`),
    "",
    "Once those details are confirmed, we can prepare the onboarding plan for human approval.",
    "",
    "Best,",
    "Client Operations",
  ].join("\n");

  return {
    confidence: liveFields?.length ? 90 : Math.min(88, 62 + fields.length * 4),
    canExecute,
    fields: fields.slice(0, 12),
    missing,
    policies,
    actions: canExecute ? customActions : [],
    clarificationDraft,
  };
}
