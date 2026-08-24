# OnboardAI

**From client request to approved workflow.**

OnboardAI is a public, synthetic-data demonstration of a trustworthy AI client-onboarding agent. It converts an unstructured agency or SaaS client request into structured facts, evaluates deterministic business controls, proposes tool actions, pauses for human approval, and records every approved mutation in an audit trail.

## Why this project exists

Most agent demos stop after generating text. OnboardAI demonstrates the engineering required after the prompt:

- structured extraction with a stable fallback dataset
- deterministic policy enforcement
- human-in-the-loop approval
- idempotent tool execution and safe retry behavior
- durable run, event, and artifact records
- explicit safe stops when required information is missing
- a public workflow that never sends real email, invitations, or calendar events

## Live workflow

1. Pick one of three synthetic client requests.
2. Run structured analysis.
3. Inspect extracted fields, sources, policy checks, and proposed actions.
4. Approve or reject the plan.
5. Watch sandbox tools execute in order.
6. Inspect the immutable audit timeline and generated record identifiers.

The **Copper & Co.** scenario deliberately triggers a calendar-provider timeout. The agent records the failure and retries once using the same workflow context. The **Fieldnote** scenario intentionally omits required information and proves that policy controls stop execution.

## Architecture

```text
Browser workspace
  → analysis API
      → Gemini extraction (when configured)
      → verified demo extraction (fallback)
      → deterministic policy and planning layer
      → D1 run/event record
  → human approval
  → execution API
      → sandbox CRM / project / identity / calendar / email tools
      → idempotent retry handling
      → D1 tool artifacts and audit events
```

The model can extract and draft, but it cannot approve actions, bypass policy, or invoke tools directly.

## Technology

- Next.js 16, React 19, TypeScript
- Vinext and Cloudflare Workers
- Cloudflare D1 with Drizzle ORM
- Gemini API with structured JSON output (optional live engine)
- CSS-first responsive product interface
- Node evaluation and rendered-output tests

## Local setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The application works without a model key by using the frozen verified demo dataset. To enable live extraction, set `GEMINI_API_KEY`. Keep demo inputs synthetic when using a free model tier.

## Quality gates

```bash
npm run lint
npm run eval
npm test
```

The policy evaluation suite covers ready, human-review, and safe-stop outcomes. It verifies that missing legal identity, approver, billing, signed-scope, and timeline requirements cannot silently reach execution.

## Security model

- synthetic data only
- server-side model credentials
- allowlisted scenario identifiers
- deterministic authorization boundary before tools
- no arbitrary tool names accepted from the browser
- server-side action lookup and run/scenario matching
- persistent audit records for analysis, approval, retry, tool, and outcome events
- no real external side effects in the public demo

See [SECURITY.md](./SECURITY.md) for the threat model.

## Portfolio embed

The `/embed` route is a compact, responsive preview designed for an iframe or portfolio project card. It links to the complete workspace without duplicating the application inside the portfolio.

## License

The source is provided as a portfolio and educational demonstration. All represented companies, contacts, documents, identifiers, and tool outputs are fictional.
