import { createFileRoute } from "@tanstack/react-router";
import { flags, secretMatches } from "@/lib/ancora/config.server";
import { deliverZapi } from "@/lib/ancora/zapi.server";
import { buildRuntime, drain, handleIngress } from "@/lib/ancora/pipeline";
import { createDbRepo } from "@/lib/ancora/repo.server";
import { getSql } from "@/lib/db";
import type { IngressEvent } from "@/lib/ancora/types";

function json(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function textOf(payload: Record<string, unknown>): string {
  const text = asRecord(payload.text);
  if (typeof text?.message === "string") return text.message;
  if (typeof payload.body === "string") return payload.body;
  if (typeof payload.message === "string") return payload.message;
  return "";
}

function normalize(payload: Record<string, unknown>): IngressEvent | null {
  const id = payload.messageId || payload.id || payload.providerMessageId;
  const phone = payload.phone || payload.fromPhone;
  if (typeof id !== "string" || typeof phone !== "string") return null;
  const ad = asRecord(payload.externalAdReply);
  return {
    providerMessageId: id,
    connectedPhone: typeof payload.connectedPhone === "string" ? payload.connectedPhone : null,
    fromPhone: phone,
    fromMe: payload.fromMe === true,
    body: textOf(payload),
    pushName: typeof payload.senderName === "string" ? payload.senderName : null,
    referralSourceId: typeof ad?.sourceId === "string" ? ad.sourceId : null,
    campaignProduct: payload.campaignProduct === "senior" || payload.campaignProduct === "health" ? payload.campaignProduct : null,
    campaignCity: typeof payload.campaignCity === "string" ? payload.campaignCity : null,
    internalChannel: payload.internalChannel === "filo" ? "filo" : null,
    filoResponsible: typeof payload.filoResponsible === "string" ? payload.filoResponsible : null,
    filoClientPhone: typeof payload.filoClientPhone === "string" ? payload.filoClientPhone : null,
    filoClientName: typeof payload.filoClientName === "string" ? payload.filoClientName : null,
    knownQuoteId: typeof payload.knownQuoteId === "string" ? payload.knownQuoteId : null,
    isGroup: payload.isGroup === true,
  };
}

async function ownerId(): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ owner_user_id: string }>`select owner_user_id from workspace_binding where id = 'b'`;
  return rows[0]?.owner_user_id ?? null;
}

export const Route = createFileRoute("/api/webhooks/zapi")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const state = flags();
        const token = request.headers.get("x-ancora-webhook-token");
        if (!state.webhookConfigured) {
          return json(503, {
            workspace: "B",
            implemented: true,
            acceptsTraffic: false,
            code: "WEBHOOK_NOT_CONFIGURED",
          });
        }
        if (!secretMatches(token, process.env.ZAPI_WEBHOOK_SECRET)) {
          return json(401, { code: "UNAUTHORIZED" });
        }
        const owner = await ownerId();
        if (!owner) return json(409, { code: "WORKSPACE_UNCLAIMED" });
        const raw = await request.text();
        if (raw.length > 65536) return json(413, { code: "PAYLOAD_TOO_LARGE" });
        let payload: Record<string, unknown> | null = null;
        try {
          payload = asRecord(JSON.parse(raw));
        } catch {
          return json(400, { code: "INVALID_JSON" });
        }
        if (!payload) return json(400, { code: "INVALID_JSON" });
        if (payload.isGroup === true && !payload.phone) return json(200, { code: "GROUP_IGNORED" });
        const event = normalize(payload);
        if (!event) return json(400, { code: "INVALID_EVENT" });
        const repo = createDbRepo(owner);
        const result = await handleIngress(
          repo,
          event,
          buildRuntime({
            now: new Date(),
            source: "zapi",
            sendsEnabled: state.sendsEnabled,
            dianaEnabled: state.dianaEnabled,
            selfPhone: state.selfPhone,
            scenario: null,
            deliver: deliverZapi,
          }),
        );
        await drain(
          repo,
          buildRuntime({
            now: new Date(),
            source: "zapi",
            sendsEnabled: state.sendsEnabled,
            dianaEnabled: state.dianaEnabled,
            selfPhone: state.selfPhone,
            scenario: null,
            deliver: deliverZapi,
          }),
        );
        return json(200, {
          code: result.code,
          stored: result.stored,
          sendsEnabled: state.sendsEnabled,
        });
      },
    },
  },
});

