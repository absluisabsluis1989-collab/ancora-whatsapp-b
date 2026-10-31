import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Conversation } from "./types.ts";

async function open(userId: string) {
  const { claimWorkspace, createDbRepo } = await import("./repo.server.ts");
  const claim = await claimWorkspace(userId);
  if (!claim.ok) return { ok: false as const };
  return { ok: true as const, repo: createDbRepo(userId) };
}

async function kit() {
  const [{ flags }, pipeline] = await Promise.all([
    import("./config.server.ts"),
    import("./pipeline.ts"),
  ]);
  const state = flags();
  const now = () =>
    pipeline.buildRuntime({
      now: new Date(),
      source: "panel",
      sendsEnabled: state.sendsEnabled,
      dianaEnabled: state.dianaEnabled,
      selfPhone: state.selfPhone,
      scenario: null,
    });
  return { state, pipeline, now };
}

export const loadBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await open(context.userId);
    if (!gate.ok) return { forbidden: true as const };
    const { state, pipeline, now } = await kit();
    await pipeline.drain(gate.repo, now());
    const [settings, provider, conversations, jobs, notices, files, notes, wallet] = await Promise.all([
      gate.repo.getSettings(),
      gate.repo.getProvider(),
      gate.repo.listConversations(),
      gate.repo.listJobs(),
      gate.repo.listNotices(),
      gate.repo.listFiles(),
      gate.repo.listNotes(),
      gate.repo.listWallet(),
    ]);
    return {
      forbidden: false as const,
      settings,
      provider,
      conversations,
      jobs,
      notices,
      files,
      notes,
      wallet: wallet.filter((row) => !row.simulated),
      flags: state,
    };
  });

export const loadConversation = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data }) => {
    const gate = await open(context.userId);
    if (!gate.ok) return { forbidden: true as const };
    const conversation = await gate.repo.getConversation(data);
    if (!conversation) return { forbidden: false as const, missing: true as const };
    const [messages, quotes, parts, audits, wallet] = await Promise.all([
      gate.repo.listMessages(data),
      gate.repo.listQuotes(data),
      gate.repo.listParts(data),
      gate.repo.listAudits(data),
      gate.repo.findWalletByPhone(conversation.phone),
    ]);
    return {
      forbidden: false as const,
      missing: false as const,
      conversation,
      messages,
      quotes,
      parts,
      audits,
      wallet: wallet && !wallet.simulated ? wallet : null,
    };
  });

export const saveConversationDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; draft: string }) => ({
    id: input.id,
    draft: input.draft.slice(0, 4000),
  }))
  .handler(async ({ context, data }) => {
    const gate = await open(context.userId);
    if (!gate.ok) return { ok: false };
    const { pipeline } = await kit();
    await pipeline.saveDraft(gate.repo, data.id, data.draft);
    return { ok: true };
  });

export const setConversationAutomation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; automation: Conversation["automation"] }) => input)
  .handler(async ({ context, data }) => {
    const gate = await open(context.userId);
    if (!gate.ok) return { ok: false };
    const { pipeline, now } = await kit();
    await pipeline.setAutomation(gate.repo, data.id, data.automation, now());
    return { ok: true };
  });

export const setWorkspacePause = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((paused: boolean) => paused)
  .handler(async ({ context, data }) => {
    const gate = await open(context.userId);
    if (!gate.ok) return { ok: false };
    const { pipeline, now } = await kit();
    await pipeline.setGlobalPause(gate.repo, data, now());
    return { ok: true };
  });

export const runLabScenario = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data }) => {
    const gate = await open(context.userId);
    if (!gate.ok) return { forbidden: true as const };
    const { runScenario } = await import("./scenarios.ts");
    const report = await runScenario(gate.repo, data);
    return { forbidden: false as const, report };
  });

export const clearLab = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await open(context.userId);
    if (!gate.ok) return { ok: false };
    await gate.repo.clearSimulation();
    return { ok: true };
  });

export const approveDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; body: string }) => ({
    id: input.id,
    body: input.body.slice(0, 4000),
  }))
  .handler(async ({ context, data }) => {
    const gate = await open(context.userId);
    if (!gate.ok) return { ok: false, state: "forbidden" };
    const conversation = await gate.repo.getConversation(data.id);
    if (!conversation) return { ok: false, state: "missing" };
    const { pipeline, now } = await kit();
    const result = await pipeline.approvePersonal(
      gate.repo,
      data.id,
      conversation.phone,
      data.body,
      null,
      now(),
    );
    return { ok: true, state: result.state };
  });

export const releaseAttachment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data }) => {
    const gate = await open(context.userId);
    if (!gate.ok) return { ok: false, state: "forbidden" };
    const { pipeline, now } = await kit();
    const part = await pipeline.releaseNextPart(gate.repo, data, now());
    return { ok: true, state: part?.state || "none" };
  });

export const markNoticesRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await open(context.userId);
    if (!gate.ok) return { ok: false };
    const now = new Date().toISOString();
    for (const notice of await gate.repo.listNotices()) {
      if (!notice.readAt) await gate.repo.markNoticeRead(notice.id, now);
    }
    return { ok: true };
  });

export const updateRetention = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((days: number) => Math.max(7, Math.min(3650, Math.round(days))))
  .handler(async ({ context, data }) => {
    const gate = await open(context.userId);
    if (!gate.ok) return { ok: false };
    const settings = await gate.repo.getSettings();
    settings.retentionDays = data;
    await gate.repo.saveSettings(settings);
    return { ok: true };
  });

export const runRetention = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await open(context.userId);
    if (!gate.ok) return { archived: 0 };
    const { pipeline } = await kit();
    return pipeline.archiveExpired(gate.repo, new Date());
  });

export const askModule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { module: "sales" | "personal" | "diana"; text: string }) => ({
    module: input.module,
    text: input.text.slice(0, 2000),
  }))
  .handler(async ({ context, data }) => {
    const gate = await open(context.userId);
    if (!gate.ok) return { ok: false, answer: "" };
    const now = new Date().toISOString();
    await gate.repo.insertNote({
      id: crypto.randomUUID(),
      module: data.module,
      role: "luis",
      body: data.text,
      createdAt: now,
    });
    const injection = /ignore previous|set admin|DATABASE_URL|system prompt/i.test(data.text);
    const answer = injection
      ? "Comando ignorado. Permissão não muda por texto. Só o painel autenticado pausa, retoma ou aprova."
      : data.module === "sales"
        ? "Eu peço só o que falta: cidade, idades e vínculo quando a DIANA exigir. Não invento preço, rede nem carência. Sem DIANA conectada, a cotação fica pendente."
        : data.module === "personal"
          ? "Assunto pessoal não entra no vendedor nem no CRM. Eu não envio nada sem a sua aprovação do destinatário, do texto e dos anexos."
          : "A DIANA está desconectada. O contrato ancora.whatsapp.diana.v1 está pronto; o endpoint recusa tráfego até a ativação.";
    await gate.repo.insertNote({
      id: crypto.randomUUID(),
      module: data.module,
      role: "module",
      body: answer,
      createdAt: now,
    });
    return { ok: true, answer, modelValidated: false };
  });

export const scenarioCatalog = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const { SCENARIOS } = await import("./scenarios.ts");
    return SCENARIOS;
  });
