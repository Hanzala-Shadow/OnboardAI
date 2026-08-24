import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { runEvents, runs, toolRecords } from "../../../db/schema";
import { customScenario } from "../../../lib/custom";
import { getScenario } from "../../../lib/scenarios";

function artifactId(tool: string) {
  const prefix = tool.replace(/[^A-Z]/gi, "").slice(0, 3).toUpperCase() || "ACT";
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      runId?: string;
      scenarioId?: string;
      actionId?: string;
      decision?: "approve" | "reject" | "complete";
    };
    if (!payload.runId || !payload.scenarioId) return Response.json({ error: "Run context is required" }, { status: 400 });
    const scenario = payload.scenarioId === "custom" ? customScenario : getScenario(payload.scenarioId);
    if (!scenario) return Response.json({ error: "Unknown scenario" }, { status: 400 });
    const db = getDb();
    const [run] = await db.select().from(runs).where(eq(runs.id, payload.runId)).limit(1);
    if (!run || run.scenarioId !== scenario.id) return Response.json({ error: "Run not found" }, { status: 404 });

    if (payload.decision === "reject") {
      if (!["review", "needs_info"].includes(run.status)) return Response.json({ error: "This run can no longer be rejected" }, { status: 409 });
      await db.batch([
        db.update(runs).set({ status: "rejected", completedAt: new Date().toISOString() }).where(eq(runs.id, payload.runId)),
        db.insert(runEvents).values({ runId: payload.runId, kind: "approval", title: "Plan rejected by reviewer", detail: "No tools were called", status: "blocked" }),
      ]);
      return Response.json({ status: "rejected" });
    }

    if (payload.decision === "approve") {
      if (run.status !== "review") {
        await db.insert(runEvents).values({ runId: payload.runId, kind: "policy_block", title: "Unauthorized execution blocked", detail: "The run did not pass the policy gate", status: "blocked" });
        return Response.json({ error: "Policy approval is required before execution" }, { status: 409 });
      }
      await db.batch([
        db.update(runs).set({ status: "executing" }).where(eq(runs.id, payload.runId)),
        db.insert(runEvents).values({ runId: payload.runId, kind: "approval", title: "Plan approved by reviewer", detail: `${scenario.actions.length} actions authorized` }),
      ]);
      return Response.json({ status: "executing" });
    }

    if (payload.decision === "complete") {
      if (run.status !== "executing") return Response.json({ error: "Only an executing run can be completed" }, { status: 409 });
      await db.batch([
        db.update(runs).set({ status: "complete", completedAt: new Date().toISOString() }).where(eq(runs.id, payload.runId)),
        db.insert(runEvents).values({ runId: payload.runId, kind: "outcome", title: "Onboarding workflow completed", detail: `${scenario.actions.length} actions completed with an audit trail` }),
      ]);
      return Response.json({ status: "complete" });
    }

    const action = scenario.actions.find((item) => item.id === payload.actionId);
    if (!action) return Response.json({ error: "Unknown action" }, { status: 400 });
    if (run.status !== "executing") {
      await db.insert(runEvents).values({ runId: payload.runId, kind: "policy_block", title: "Locked tool call blocked", detail: `${action.tool} remained locked because the run was not approved`, status: "blocked" });
      return Response.json({ error: "Approve the plan before running sandbox actions" }, { status: 409 });
    }

    if (scenario.id === "copper" && action.id === "calendar-update") {
      const previousRetries = await db.select().from(runEvents).where(and(eq(runEvents.runId, payload.runId), eq(runEvents.kind, "tool_retry"))).limit(1);
      if (previousRetries.length === 0) {
        await db.insert(runEvents).values({ runId: payload.runId, kind: "tool_retry", title: "Calendar provider timed out", detail: "Safe retry scheduled with the same idempotency key", status: "retrying" });
        return Response.json({ error: "Calendar provider timeout", retryable: true }, { status: 503 });
      }
    }

    const externalId = artifactId(action.tool);
    await db.batch([
      db.insert(toolRecords).values({
        runId: payload.runId,
        actionId: action.id,
        tool: action.tool,
        externalId,
        payload: JSON.stringify({ company: scenario.company, title: action.title, synthetic: true }),
      }),
      db.insert(runEvents).values({ runId: payload.runId, kind: "tool", title: action.title, detail: `${action.tool} · ${externalId}` }),
    ]);

    return Response.json({ status: "complete", artifact: { actionId: action.id, tool: action.tool, externalId, title: action.title } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Execution failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
