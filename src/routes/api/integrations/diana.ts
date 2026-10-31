import { createFileRoute } from "@tanstack/react-router";
import { flags, secretMatches } from "@/lib/ancora/config.server";
import { DIANA_CONTRACT } from "@/lib/ancora/contract";

function json(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export const Route = createFileRoute("/api/integrations/diana")({
  server: {
    handlers: {
      GET: () =>
        json(flags().dianaEnabled ? 200 : 423, {
          workspace: "B",
          implemented: true,
          enabled: flags().dianaEnabled,
          code: flags().dianaEnabled ? "READY" : "INTEGRATION_DISABLED",
          contract: DIANA_CONTRACT.name,
        }),
      POST: async ({ request }) => {
        const state = flags();
        if (!state.dianaEnabled) {
          return json(423, {
            workspace: "B",
            implemented: true,
            enabled: false,
            code: "INTEGRATION_DISABLED",
            contract: DIANA_CONTRACT.name,
          });
        }
        const header = request.headers.get("authorization") || "";
        const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
        if (!secretMatches(token, process.env.DIANA_INTEGRATION_TOKEN)) {
          return json(401, { code: "UNAUTHORIZED" });
        }
        return json(501, {
          code: "CALLBACK_READY_NOT_WIRED",
          message: "Token válido, mas a gravação do retorno real ainda depende da etapa combinada com o Codex.",
        });
      },
    },
  },
});
