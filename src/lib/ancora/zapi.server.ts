import { flags } from "./config.server.ts";

export type SendState = "accepted" | "failed" | "uncertain" | "blocked_send_disabled";

/** Provider acceptance is not delivery and not read. */
export async function deliverZapi(input: {
  phone: string;
  body: string;
  attachmentRef: string | null;
}): Promise<SendState> {
  const state = flags();
  if (!state.sendsEnabled) return "blocked_send_disabled";
  if (!state.zapiCredentialsConfigured) return "failed";
  if (input.attachmentRef) return "failed";
  const instance = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `https://api.z-api.io/instances/${instance}/token/${token}/send-text`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          ...(process.env.ZAPI_CLIENT_TOKEN
            ? { "client-token": process.env.ZAPI_CLIENT_TOKEN }
            : {}),
        },
        body: JSON.stringify({ phone: input.phone, message: input.body }),
      },
    );
    if (!response.ok) return "failed";
    return "accepted";
  } catch (error) {
    return error instanceof Error && error.name === "AbortError" ? "uncertain" : "uncertain";
  } finally {
    clearTimeout(timer);
  }
}
