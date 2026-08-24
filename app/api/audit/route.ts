import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { runEvents, runs, toolRecords } from "../../../db/schema";

export async function GET(request: Request) {
  try {
    const runId = new URL(request.url).searchParams.get("runId");
    if (!runId) return Response.json({ error: "runId is required" }, { status: 400 });
    const db = getDb();
    const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
    const [events, artifacts] = await Promise.all([
      db.select().from(runEvents).where(eq(runEvents.runId, runId)).orderBy(asc(runEvents.id)),
      db.select().from(toolRecords).where(eq(toolRecords.runId, runId)).orderBy(asc(toolRecords.id)),
    ]);
    return Response.json({ run, events, artifacts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit unavailable";
    return Response.json({ error: message }, { status: 500 });
  }
}
