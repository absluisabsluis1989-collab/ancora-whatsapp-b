import { createFileRoute } from "@tanstack/react-router";
import { flags, secretMatches } from "@/lib/ancora/config.server";
import { buildRuntime, drain } from "@/lib/ancora/pipeline";
import { createDbRepo } from "@/lib/ancora/repo.server";
import { getSql } from "@/lib/db";

function json(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function tick(request: Request) {
  const state = flags();
  const header = request.headers.get("authorization") || "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const token = request.headers.get("x-ancora-queue-token") || bearer;
  const expected = process.env.QUEUE_TICK_SECRET || process.env.CRON_SECRET;
  if (!state.queueTickConfigured) {
    return json(503, { implemented: true, code: "TICK_NOT_CONFIGURED" });
  }
  if (!secretMatches(token, expected)) return json(401, { code: "UNAUTHORIZED" });
  const sql = await getSql();
  const rows = await sql<{ owner_user_id: string }>`select owner_user_id from workspace_binding where id = 'b'`;
  const owner = rows[0]?.owner_user_id;
  if (!owner) return json(409, { code: "WORKSPACE_UNCLAIMED" });
  const processed = await drain(
    createDbRepo(owner),
    buildRuntime({
      now: new Date(),
      source: "panel",
      sendsEnabled: state.sendsEnabled,
      dianaEnabled: state.dianaEnabled,
      selfPhone: state.selfPhone,
      scenario: null,
    }),
  );
  return json(200, { code: "DRAINED", processed, sendsEnabled: state.sendsEnabled });
}

export const Route = createFileRoute("/api/queue/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => tick(request),
      GET: async ({ request }) => tick(request),
    },
  },
});
