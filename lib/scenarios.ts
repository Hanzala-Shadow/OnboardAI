export type WorkflowAction = {
  id: string;
  tool: string;
  title: string;
  detail: string;
  minutesSaved: number;
  risk: "low" | "review";
};

export type PolicyCheck = {
  label: string;
  detail: string;
  status: "pass" | "warning" | "blocked";
};

export type Scenario = {
  id: string;
  company: string;
  contact: string;
  email: string;
  subject: string;
  received: string;
  tone: string;
  avatar: string;
  body: string[];
  attachments: { kind: string; name: string; size: string }[];
  confidence: number;
  canExecute: boolean;
  fields: { label: string; value: string; source: string }[];
  missing: string[];
  policies: PolicyCheck[];
  actions: WorkflowAction[];
  clarificationDraft?: string;
};

export const scenarios: Scenario[] = [
  {
    id: "northstar",
    company: "Northstar Labs",
    contact: "Maya Chen",
    email: "maya.chen@northstar.example",
    subject: "Kickoff for analytics redesign",
    received: "2 min ago",
    tone: "Ready",
    avatar: "N",
    body: [
      "Hi team,",
      "We're ready to begin the analytics dashboard redesign. I've attached our signed scope and brand brief. We'd like to kick off on September 8 and aim for a six-week delivery.",
      "Priya will be the day-to-day approver. Please set up the project workspace, invite our team, and send over the kickoff options.",
      "Thanks,\nMaya",
    ],
    attachments: [
      { kind: "PDF", name: "Signed scope.pdf", size: "824 KB" },
      { kind: "DOC", name: "Brand brief.docx", size: "1.2 MB" },
    ],
    confidence: 96,
    canExecute: true,
    fields: [
      { label: "Company", value: "Northstar Labs", source: "Email" },
      { label: "Primary contact", value: "Maya Chen", source: "Email" },
      { label: "Project", value: "Analytics dashboard redesign", source: "Email" },
      { label: "Kickoff", value: "08 Sep 2026", source: "Email" },
      { label: "Delivery window", value: "6 weeks", source: "Email" },
      { label: "Approver", value: "Priya Raman", source: "Scope §4" },
      { label: "Team seats", value: "5", source: "Scope §6" },
      { label: "Budget", value: "$24,000", source: "Scope §2" },
    ],
    missing: [],
    policies: [
      { label: "Signed scope", detail: "Signature and effective date found", status: "pass" },
      { label: "Lead time", detail: "10 business days before kickoff", status: "pass" },
      { label: "Named approver", detail: "Priya Raman has approval authority", status: "pass" },
      { label: "Budget threshold", detail: "Within standard delivery band", status: "pass" },
    ],
    actions: [
      { id: "crm-create", tool: "CRM", title: "Create client record", detail: "Northstar Labs · Maya Chen", minutesSaved: 6, risk: "low" },
      { id: "workspace-create", tool: "Projects", title: "Open delivery workspace", detail: "Analytics redesign · 6-week template", minutesSaved: 7, risk: "low" },
      { id: "contacts-invite", tool: "Identity", title: "Prepare 5 workspace invites", detail: "Invites remain unsent until approved", minutesSaved: 4, risk: "review" },
      { id: "tasks-create", tool: "Projects", title: "Create 14 onboarding tasks", detail: "Owners and due dates included", minutesSaved: 9, risk: "low" },
      { id: "calendar-propose", tool: "Calendar", title: "Propose kickoff windows", detail: "Three PKT/ET overlap options", minutesSaved: 4, risk: "review" },
      { id: "email-draft", tool: "Email", title: "Draft welcome message", detail: "Links, owners, and next steps", minutesSaved: 4, risk: "review" },
    ],
  },
  {
    id: "copper",
    company: "Copper & Co.",
    contact: "Elliot Hart",
    email: "elliot.hart@copper.example",
    subject: "Brand sprint — timeline change",
    received: "18 min ago",
    tone: "Review",
    avatar: "C",
    body: [
      "Hello,",
      "The launch moved forward, so we need the brand sprint completed by September 18 instead of October 2. The signed scope is unchanged and our budget remains $18,500.",
      "Can you revise the project plan, keep Lena as approver, and update the kickoff invitation?",
      "Best,\nElliot",
    ],
    attachments: [{ kind: "PDF", name: "Original scope.pdf", size: "640 KB" }],
    confidence: 91,
    canExecute: true,
    fields: [
      { label: "Company", value: "Copper & Co.", source: "Email" },
      { label: "Primary contact", value: "Elliot Hart", source: "Email" },
      { label: "Project", value: "Brand sprint", source: "Scope §1" },
      { label: "New deadline", value: "18 Sep 2026", source: "Email" },
      { label: "Original deadline", value: "02 Oct 2026", source: "Scope §3" },
      { label: "Approver", value: "Lena Ortiz", source: "Scope §4" },
      { label: "Budget", value: "$18,500", source: "Email + scope" },
      { label: "Schedule impact", value: "High", source: "Policy engine" },
    ],
    missing: [],
    policies: [
      { label: "Signed scope", detail: "Original agreement is valid", status: "pass" },
      { label: "Timeline variance", detail: "Deadline changed by 10 business days", status: "warning" },
      { label: "Approver unchanged", detail: "Lena Ortiz remains authorized", status: "pass" },
      { label: "Change-order gate", detail: "Delivery lead must approve compression", status: "warning" },
    ],
    actions: [
      { id: "crm-update", tool: "CRM", title: "Record timeline request", detail: "Preserve original scope and deadline", minutesSaved: 4, risk: "low" },
      { id: "timeline-replan", tool: "Planner", title: "Generate compressed plan", detail: "Flags two resource conflicts", minutesSaved: 12, risk: "review" },
      { id: "tasks-reschedule", tool: "Projects", title: "Prepare task reschedule", detail: "11 dates require approval", minutesSaved: 8, risk: "review" },
      { id: "calendar-update", tool: "Calendar", title: "Update kickoff hold", detail: "Retries safely on provider timeout", minutesSaved: 3, risk: "review" },
      { id: "change-draft", tool: "Email", title: "Draft change-order reply", detail: "Calls out timing and resource risks", minutesSaved: 5, risk: "review" },
    ],
  },
  {
    id: "fieldnote",
    company: "Fieldnote",
    contact: "Amara Okafor",
    email: "amara@fieldnote.example",
    subject: "New workspace onboarding",
    received: "41 min ago",
    tone: "Missing info",
    avatar: "F",
    body: [
      "Hi there,",
      "We'd like to get started with the research workspace next week. Please create accounts for the product team and send the onboarding materials.",
      "Our operations lead will approve everything. Let me know what else you need.",
      "Regards,\nAmara",
    ],
    attachments: [{ kind: "DOC", name: "Team list.docx", size: "92 KB" }],
    confidence: 84,
    canExecute: false,
    fields: [
      { label: "Company", value: "Fieldnote", source: "Email" },
      { label: "Primary contact", value: "Amara Okafor", source: "Email" },
      { label: "Project", value: "Research workspace", source: "Email" },
      { label: "Requested start", value: "Next week", source: "Email" },
      { label: "Team seats", value: "8", source: "Team list" },
    ],
    missing: ["Legal company name", "Named approver", "Billing contact"],
    policies: [
      { label: "Legal identity", detail: "Registered company name is missing", status: "blocked" },
      { label: "Named approver", detail: "A role is not sufficient for approval", status: "blocked" },
      { label: "Billing contact", detail: "Required before account provisioning", status: "blocked" },
      { label: "Team list", detail: "8 valid work addresses found", status: "pass" },
    ],
    actions: [],
    clarificationDraft: "Hi Amara,\n\nThanks — we have the eight team members and your preferred start window. Before we provision the workspace, could you confirm the legal company name, the full name of the authorized approver, and the billing contact?\n\nOnce received, we can complete setup without another intake form.\n\nBest,\nClient Operations",
  },
];

export function getScenario(id: string) {
  return scenarios.find((scenario) => scenario.id === id);
}
