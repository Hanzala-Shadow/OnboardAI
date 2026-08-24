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

function firstCaptured(value: string, expressions: RegExp[]) {
  for (const expression of expressions) {
    const match = value.match(expression);
    const captured = match?.slice(1).find(Boolean)?.replace(/\s+/g, " ").trim();
    if (captured) return captured;
  }
  return undefined;
}

function safeField(field: ExtractedField): ExtractedField | null {
  const label = compact(String(field.label ?? ""), 60);
  const value = compact(String(field.value ?? ""), 180);
  const source = compact(String(field.source ?? ""), 80);
  return label && value && source ? { label, value, source } : null;
}

function mergeFields(primary: ExtractedField[], secondary: ExtractedField[]) {
  const seen = new Set<string>();
  return [...primary, ...secondary].filter((field) => {
    const key = field.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildCustomAnalysis(request: CustomRequest, liveFields?: ExtractedField[] | null) {
  const text = `${request.subject}\n${request.body}`;
  const normalized = request.body.replace(/\s+/g, " ").trim();
  const approver = firstCaptured(text, [
    /(?:named\s+)?(?:approver|approval contact|authorized approver|sign[- ]?off)(?:\s+(?:is|will be|from))?\s*[:=-]?\s*([A-Za-z][A-Za-z '-]{1,60}?)(?=[,.;\n]|$)/i,
    /([A-Za-z][A-Za-z '-]{1,60}?)\s+is\s+(?:the\s+)?(?:named\s+)?approver(?=[,.;\n]|$)/i,
    /approval\s+(?:should\s+)?(?:go|come|route)\s+(?:through|to|from)\s+([A-Za-z][A-Za-z '-]{1,60}?)(?=[,.;\n]|$)/i,
    /([A-Za-z][A-Za-z '-]{1,60}?)\s+(?:will|can|should)\s+(?:approve|authorize|sign off)(?=[,.;\n]|$)/i,
  ]);
  const billingEmail = firstCaptured(text, [
    /(?:billing|finance|accounts payable|invoice)(?:\s+contact)?(?:\s+(?:is|email is|email))?\s*[:=-]?\s*([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/i,
  ]);
  const budget = firstCaptured(text, [
    /((?:USD|EUR|GBP|PKR|CAD|AUD|\$|€|£)\s?[\d,.]+(?:\s?(?:k|K|thousand|million))?(?:\s*(?:per month|monthly|\/month))?)/i,
    /([\d,.]+(?:\s?(?:k|K|thousand|million))?\s*(?:USD|EUR|GBP|PKR|CAD|AUD)(?:\s*(?:per month|monthly|\/month))?)/i,
    /(?:budget|commercial limit|spend)(?:\s+(?:is|of))?\s*[:=-]?\s*([\d,.]+(?:\s?(?:k|K|thousand|million))?(?:\s*(?:per month|monthly|\/month))?)/i,
  ]);
  const kickoff = firstCaptured(text, [
    /(?:kickoff|kick-off|start date|launch date)(?:\s+(?:is|on|by))?\s*[:=-]?\s*([^,.;\n]{2,45})/i,
    /(?:begin|start|kick off|launch)\s+(?:on|by)\s+([^,.;\n]{2,45})/i,
  ]);
  const delivery = firstCaptured(text, [
    /(?:deadline|delivery target|delivery date|go-live date|go live date)(?:\s+(?:is|on|by))?\s*[:=-]?\s*([^,.;\n]{2,45})/i,
    /(?:complete|deliver|finish|go live)\s+(?:on|by|within)\s+([^,.;\n]{2,45})/i,
    /(?:delivery window|timeline)(?:\s+(?:is|of))?\s*[:=-]?\s*([^,.;\n]{2,45})/i,
  ]);
  const seatMatch = text.match(/(?:invite|add|create accounts? for|team of|seats? for)\s+(\d{1,3})|(\d{1,3})\s+(?:team members?|people|users?|accounts?|seats?)/i);
  const seats = seatMatch?.[1] || seatMatch?.[2];
  const timezoneMatches = [...text.matchAll(/\b(PKT|ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT|GMT|BST|CET|CEST|IST|UTC(?:[+-]\d{1,2}(?::\d{2})?)?)\b/gi)].map((match) => match[1].toUpperCase());
  const explicitTimezone = firstCaptured(text, [/(?:timezone|time zone)(?:\s+is)?\s*[:=-]?\s*([A-Za-z]{2,5}(?:[+-]\d{1,2}(?::\d{2})?)?)/i]);
  const timezone = [...new Set([explicitTimezone, ...timezoneMatches].filter(Boolean))].slice(0, 2).join(" / ") || undefined;
  const project = request.subject || firstCaptured(normalized, [/^(.{20,120}?)(?=[.!?]|$)/]);
  const sensitiveData = /(?:password|passcode|api[-_ ]?key|access[-_ ]?token|private[-_ ]?key|secret)\s*[:=]\s*\S{4,}/i.test(text);

  const localFields = [
    request.company && { label: "Client", value: request.company, source: "Custom field" },
    request.contactEmail && { label: "Contact", value: request.contactEmail, source: "Custom field" },
    project && { label: "Project", value: compact(project, 140), source: request.subject ? "Subject" : "Request text" },
    kickoff && { label: "Kickoff", value: kickoff, source: "Request text" },
    delivery && { label: "Delivery target", value: delivery, source: "Request text" },
    budget && { label: "Budget", value: budget, source: "Request text" },
    seats && { label: "Team seats", value: seats, source: "Request text" },
    approver && { label: "Approver", value: approver, source: "Request text" },
    billingEmail && { label: "Billing contact", value: billingEmail, source: "Request text" },
    timezone && { label: "Client timezone", value: timezone, source: "Request text" },
  ].filter((field): field is ExtractedField => Boolean(field));
  const modelFields = (liveFields ?? []).map(safeField).filter((field): field is ExtractedField => Boolean(field));
  const fields = mergeFields(localFields, modelFields).slice(0, 14);

  const hasCompany = request.company.length >= 2;
  const hasContact = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.contactEmail);
  const hasScope = normalized.length >= 80 && normalized.split(/\s+/).length >= 12;
  const hasApprover = Boolean(approver);
  const policies: PolicyCheck[] = [
    { label: "Client identity", detail: hasCompany ? `${request.company} is identified` : "A client or company name is required", status: hasCompany ? "pass" : "blocked" },
    { label: "Contact channel", detail: hasContact ? "A valid contact email is available" : "A valid contact email is required", status: hasContact ? "pass" : "blocked" },
    { label: "Request scope", detail: hasScope ? "Enough detail exists to prepare a reviewable plan" : "Add the goal, timing, requested setup, and expected outcome", status: hasScope ? "pass" : "blocked" },
    { label: "Named approver", detail: hasApprover ? `${approver} can review consequential actions` : "Name an approver in the request before execution", status: hasApprover ? "pass" : "blocked" },
    { label: "Billing readiness", detail: billingEmail ? `Billing contact detected: ${billingEmail}` : "No billing contact detected; review before a real implementation", status: billingEmail ? "pass" : "warning" },
    { label: "Sensitive-data check", detail: sensitiveData ? "Possible credential or secret detected; remove it before continuing" : "No credential-like values detected", status: sensitiveData ? "blocked" : "pass" },
  ];
  const missing = [
    !hasCompany && "Client or company name",
    !hasContact && "Valid contact email",
    !hasScope && "Clear project goal, timing, requested setup, and expected outcome",
    !hasApprover && "Named human approver",
    sensitiveData && "Remove passwords, access keys, tokens, or secrets",
  ].filter((item): item is string => Boolean(item));
  const canExecute = missing.length === 0;
  const clarificationDraft = canExecute ? undefined : [
    `Hello${request.company ? ` ${request.company} team` : ""},`,
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
    confidence: liveFields?.length ? Math.min(94, 78 + fields.length) : Math.min(90, 60 + fields.length * 4),
    canExecute,
    fields: fields.slice(0, 12),
    missing,
    policies,
    actions: canExecute ? customActions : [],
    clarificationDraft,
  };
}
