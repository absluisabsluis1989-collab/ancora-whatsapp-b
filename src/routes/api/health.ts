import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const { flags } = await import("@/lib/ancora/config.server");
        const { dbSource, getSql } = await import("@/lib/db");
        const state = flags();
        const body = {
          workspace: state.workspace,
          stage: state.stage,
          applicationImplemented: true,
          zapiConnected: false,
          webhookConfigured: state.webhookConfigured,
          dianaConnected: false,
          dianaEnabled: state.dianaEnabled,
          modelConfigured: state.modelConfigured,
          modelRecommended: "claude-sonnet-4-6",
          sendsEnabled: state.sendsEnabled,
          selfPhone: state.selfPhone,
          queue: "postgres",
          timezone: "America/Araguaina",
        };
        try {
          const sql = await getSql();
          const rows = await sql<{ ok: number }>`select 1 as ok`;
          if (Number(rows[0]?.ok) !== 1) throw new Error("check");
          return Response.json(
            { ...body, database: "CONNECTED", databaseSource: dbSource },
            { headers: { "cache-control": "no-store" } },
          );
        } catch {
          return Response.json(
            { ...body, database: "CHECK_FAILED", databaseSource: dbSource },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
