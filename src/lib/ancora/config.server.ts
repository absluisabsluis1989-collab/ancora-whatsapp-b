import { timingSafeEqual } from "node:crypto";

export type Flags = {
  workspace: string;
  stage: string;
  selfPhone: string;
  sendsEnabled: boolean;
  dianaEnabled: boolean;
  modelConfigured: boolean;
  webhookConfigured: boolean;
  dianaSecretConfigured: boolean;
  queueTickConfigured: boolean;
  zapiCredentialsConfigured: boolean;
};

export function flags(): Flags {
  return {
    workspace: process.env.APP_WORKSPACE || "B",
    stage: process.env.APP_STAGE || "BUILD_ONLY",
    selfPhone: process.env.WHATSAPP_SELF_PHONE || "63992731001",
    sendsEnabled: process.env.ZAPI_SEND_ENABLED === "1",
    dianaEnabled: process.env.DIANA_INTEGRATION_ENABLED === "1",
    modelConfigured: process.env.MODEL_STATUS === "CONFIGURED" && Boolean(process.env.MODEL_API_KEY),
    webhookConfigured: Boolean(process.env.ZAPI_WEBHOOK_SECRET),
    dianaSecretConfigured: Boolean(process.env.DIANA_INTEGRATION_TOKEN),
    queueTickConfigured: Boolean(process.env.QUEUE_TICK_SECRET || process.env.CRON_SECRET),
    zapiCredentialsConfigured: Boolean(process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN),
  };
}

export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
