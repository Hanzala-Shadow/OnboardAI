# Security and trust model

OnboardAI is intentionally designed as a controlled automation system rather than an unrestricted autonomous agent.

## Trust boundaries

1. **Untrusted input:** Email and document text are data. Model prompts explicitly instruct the extractor not to follow instructions found inside that data.
2. **Model output:** Extracted values are proposals. The model does not choose policy outcomes, authorize actions, or supply executable tool names.
3. **Policy engine:** Required fields, signed-scope checks, timeline variance, and approval authority are evaluated by deterministic application logic.
4. **Human approval:** Executable plans pause before any mutation. Rejecting a run records the decision and calls no tools.
5. **Tool gateway:** The server resolves actions from an allowlisted scenario and verifies that the run belongs to that scenario. Browser-supplied tool definitions are ignored.
6. **Audit store:** Analysis, policy, approval, failure, retry, tool, and outcome events are stored separately from the interface state.

## Public-demo controls

- All data and output identifiers are synthetic.
- The demo does not send real messages, invitations, or calendar events.
- Secrets remain server-side and are excluded from source control.
- Inputs are limited to frozen scenarios, preventing arbitrary public prompt traffic.
- A failed provider action is retried once and remains visible in the audit trail.
- A run with missing required fields has no executable actions.

## Prompt-injection posture

The optional Gemini call is used only for structured extraction. Its output is not executable. Even if a document tries to instruct the model to bypass controls, all tool actions remain selected by server-side application data and require human approval.

## Reporting

This repository contains no production customer system or secret. If a flaw is found in the demonstration, open a GitHub issue without including credentials or private information.
