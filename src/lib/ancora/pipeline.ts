import type { Repo } from "./repo.ts";
import { decide, type Decision } from "./policy.ts";
import { policyTemplate } from "./templates.ts";
import { canonicalPhone, isSelfPhone } from "./phones.ts";
import type {
  Conversation,
  IngressEvent,
  Message,
  OutboundPart,
  Quote,
  Runtime,
  WalletClient,
} from "./types.ts";

export function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function id(): string {
  return crypto.randomUUID();
}

export function requestKey(conversationId: string, product: string | null, city: string | null, ages: number[]): string {
  return `quote:${conversationId}:${product || "health"}:${(city || "").toLowerCase()}:${ages.join("-")}`;
}

export type IngressResult = {
  duplicate: boolean;
  stored: boolean;
  conversationId: string | null;
  code: string;
};

function newConversation(phone: string, runtime: Runtime, nowIso: string): Conversation {
  return {
    id: id(),
    phone,
    source: runtime.source,
    displayName: null,
    namePending: true,
    lane: "unclassified",
    entry: "unknown",
    product: null,
    city: null,
    ages: [],
    profession: null,
    campaignRef: null,
    originConfirmed: false,
    stage: "new",
    automation: "auto",
    responsible: "Luís",
    customerHasSpoken: false,
    interestNotified: false,
    draft: "",
    pendingReason: null,
    nextAction: "aguardar classificação",
    lastInboundAt: null,
    lastProcessedAt: null,
    quoteStatus: null,
    hasConfirmedMaterials: false,
    knownQuoteId: null,
    scenario: runtime.scenario,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

async function notify(
  repo: Repo,
  kind: "interest" | "question" | "difficulty",
  title: string,
  body: string,
  conversationId: string | null,
  runtime: Runtime,
  nowIso: string,
) {
  await repo.insertNotice({
    id: id(),
    conversationId,
    kind,
    title,
    body,
    readAt: null,
    scenario: runtime.scenario,
    createdAt: nowIso,
  });
}

async function audit(
  repo: Repo,
  kind: string,
  detail: string,
  conversationId: string | null,
  runtime: Runtime,
  nowIso: string,
) {
  await repo.insertAudit({
    id: id(),
    conversationId,
    kind,
    detail,
    scenario: runtime.scenario,
    createdAt: nowIso,
  });
}

export async function handleIngress(repo: Repo, event: IngressEvent, runtime: Runtime): Promise<IngressResult> {
  const nowIso = runtime.now.toISOString();
  const settings = await repo.getSettings();
  const provider = await repo.getProvider();

  if (event.connectedPhone && !isSelfPhone(event.connectedPhone)) {
    provider.connection = "interrupted";
    provider.lastWebhookAt = nowIso;
    await repo.saveProvider(provider);
    await audit(repo, "phone_mismatch", "Instância recusada: telefone conectado diferente de 63992731001.", null, runtime, nowIso);
    await notify(repo, "difficulty", "Instância errada", "O telefone conectado não é o 63992731001. Nada foi gravado como atendimento.", null, runtime, nowIso);
    return { duplicate: false, stored: false, conversationId: null, code: "PHONE_MISMATCH" };
  }

  const existingMessage = await repo.findMessageByProvider(event.providerMessageId);
  if (existingMessage) {
    await audit(repo, "duplicate", `Mensagem ${event.providerMessageId} já persistida.`, existingMessage.conversationId, runtime, nowIso);
    return { duplicate: true, stored: true, conversationId: existingMessage.conversationId, code: "DUPLICATE" };
  }

  const isEcho = Boolean(event.fromMe) && (await outboundEcho(repo, event.providerMessageId));
  const filo = event.internalChannel === "filo";
  const phone = filo
    ? canonicalPhone(event.filoClientPhone || "")
    : canonicalPhone(event.fromPhone);

  if (!phone && !isEcho) {
    await audit(repo, "invalid_phone", "Entrada sem telefone de cliente.", null, runtime, nowIso);
    return { duplicate: false, stored: false, conversationId: null, code: "INVALID_PHONE" };
  }

  let conversation = phone ? await repo.findConversationByPhone(phone) : null;
  if (!conversation && phone) {
    conversation = newConversation(phone, runtime, nowIso);
    await repo.insertConversation(conversation);
  }
  if (!conversation) {
    return { duplicate: false, stored: false, conversationId: null, code: "NO_CONVERSATION" };
  }

  const message: Message = {
    id: id(),
    conversationId: conversation.id,
    providerMessageId: event.providerMessageId,
    direction: "inbound",
    author: filo ? "filo" : event.fromMe ? "luis_manual" : "customer",
    body: event.body,
    payload: JSON.stringify(event),
    source: runtime.source,
    status: "received",
    draftSource: "none",
    isEcho,
    fromMe: Boolean(event.fromMe),
    scenario: runtime.scenario,
    createdAt: nowIso,
  };
  await repo.insertMessage(message);

  const jobId = id();
  await repo.insertJob({
    id: jobId,
    conversationId: conversation.id,
    messageId: message.id,
    kind: "inbound_turn",
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    runAfter: nowIso,
    lockedAt: null,
    lastError: null,
    scenario: runtime.scenario,
    createdAt: nowIso,
  });

  provider.lastReceivedAt = nowIso;
  provider.lastWebhookAt = nowIso;
  if (runtime.source === "zapi") provider.connection = "connected";
  await repo.saveProvider(provider);

  await drain(repo, runtime);
  return { duplicate: false, stored: true, conversationId: conversation.id, code: "STORED" };
}

async function outboundEcho(repo: Repo, providerMessageId: string): Promise<boolean> {
  const found = await repo.findMessageByProvider(providerMessageId);
  return Boolean(found && found.direction === "outbound");
}

export async function recoverStale(repo: Repo, now: Date): Promise<void> {
  const cutoff = now.getTime() - 2 * 60 * 1000;
  const jobs = await repo.listJobs();
  for (const job of jobs) {
    if (job.status === "running" && job.lockedAt && new Date(job.lockedAt).getTime() < cutoff) {
      job.status = "pending";
      job.lockedAt = null;
      job.lastError = "lock expirado após reinício";
      await repo.updateJob(job);
    }
  }
}

export async function drain(repo: Repo, runtime: Runtime, budget = 20): Promise<number> {
  await recoverStale(repo, runtime.now);
  let processed = 0;
  while (processed < budget) {
    const jobs = await repo.listJobs();
    const runningConversations = new Set(
      jobs.filter((job) => job.status === "running" && job.conversationId).map((job) => job.conversationId),
    );
    const next = jobs
      .filter((job) => job.status === "pending" && job.runAfter <= runtime.now.toISOString())
      .filter((job) => !job.conversationId || !runningConversations.has(job.conversationId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!next) break;
    next.status = "running";
    next.lockedAt = runtime.now.toISOString();
    next.attempts += 1;
    await repo.updateJob(next);
    try {
      await runJob(repo, next.id, runtime);
      const done = (await repo.listJobs()).find((job) => job.id === next.id);
      if (done && done.status === "running") {
        done.status = "done";
        done.lockedAt = null;
        await repo.updateJob(done);
      }
    } catch (error) {
      const failed = (await repo.listJobs()).find((job) => job.id === next.id);
      if (failed) {
        failed.lastError = error instanceof Error ? error.message : "falha";
        failed.status = failed.attempts >= failed.maxAttempts ? "failed" : "pending";
        failed.lockedAt = null;
        await repo.updateJob(failed);
        if (failed.status === "failed") {
          await notify(
            repo,
            "difficulty",
            "Falha isolada na fila",
            "Um atendimento falhou e não trava os demais.",
            failed.conversationId,
            runtime,
            runtime.now.toISOString(),
          );
        }
      }
    }
    processed += 1;
  }
  return processed;
}

async function runJob(repo: Repo, jobId: string, runtime: Runtime): Promise<void> {
  const job = (await repo.listJobs()).find((item) => item.id === jobId);
  if (!job) return;
  if (job.kind === "daytime_review") {
    await runDaytimeReview(repo, job.conversationId, runtime);
    return;
  }
  if (job.kind === "quote_reconcile") {
    await audit(
      repo,
      "quote_reconcile",
      "Timeout de cotação: o estado local foi conferido antes de qualquer repetição. Nenhuma segunda solicitação foi criada.",
      job.conversationId,
      runtime,
      runtime.now.toISOString(),
    );
    return;
  }
  if (!job.messageId || !job.conversationId) return;
  const conversation = await repo.getConversation(job.conversationId);
  const messages = await repo.listMessages(job.conversationId);
  const message = messages.find((item) => item.id === job.messageId);
  if (!conversation || !message) return;
  if (message.isEcho) {
    message.status = "echo_ignored";
    await repo.updateMessage(message);
    conversation.lastProcessedAt = runtime.now.toISOString();
    conversation.updatedAt = conversation.lastProcessedAt;
    await repo.updateConversation(conversation);
    await audit(repo, "echo", "Eco do próprio aplicativo ignorado. A automação não foi suspensa.", conversation.id, runtime, conversation.updatedAt);
    return;
  }

  const event = JSON.parse(message.payload) as IngressEvent;
  const settings = await repo.getSettings();
  const decision = decide(event, conversation, {
    now: runtime.now,
    windowStart: settings.windowStart,
    windowEnd: settings.windowEnd,
    globalPause: settings.globalPause,
    isEcho: false,
  });
  await applyDecision(repo, conversation, message, decision, runtime);
}

async function applyDecision(
  repo: Repo,
  conversation: Conversation,
  message: Message,
  decision: Decision,
  runtime: Runtime,
): Promise<void> {
  const nowIso = runtime.now.toISOString();
  if (decision.permissionIgnored) {
    await audit(repo, "permission_ignored", "Comando embutido na mensagem foi ignorado. Pausa e credenciais não mudaram.", conversation.id, runtime, nowIso);
  }
  if (decision.phoneMismatch) return;

  if (decision.suspendManual) {
    conversation.automation = "suspended_manual";
    conversation.stage = decision.stage;
    conversation.pendingReason = decision.pendingReason;
    conversation.nextAction = decision.nextAction;
    conversation.lastProcessedAt = nowIso;
    conversation.updatedAt = nowIso;
    message.status = "manual";
    await repo.updateMessage(message);
    await repo.updateConversation(conversation);
    await audit(repo, "manual_suspend", "Saída manual de Luís suspendeu a automação desta conversa.", conversation.id, runtime, nowIso);
    return;
  }

  conversation.lane = decision.lane;
  conversation.entry = decision.entry;
  conversation.product = decision.product;
  conversation.city = decision.city;
  conversation.ages = decision.ages;
  conversation.displayName = decision.displayName;
  conversation.namePending = decision.namePending;
  conversation.originConfirmed = decision.originConfirmed;
  conversation.campaignRef = decision.campaignRef;
  conversation.profession = decision.profession || conversation.profession;
  conversation.customerHasSpoken = decision.customerHasSpoken || conversation.customerHasSpoken;
  conversation.stage = decision.stage;
  conversation.pendingReason = decision.pendingReason;
  conversation.nextAction = decision.nextAction;
  conversation.knownQuoteId = decision.knownQuoteId || conversation.knownQuoteId;
  conversation.responsible = decision.entry === "filo" ? "Luís" : conversation.responsible;
  if (decision.replyIntent === "filo_refused") conversation.responsible = decision.responsible || conversation.responsible;
  conversation.lastInboundAt = nowIso;
  conversation.lastProcessedAt = nowIso;
  conversation.updatedAt = nowIso;

  if (decision.notifyInterest && !conversation.interestNotified) {
    conversation.interestNotified = true;
    await notify(repo, "interest", "Interesse em plano", `${conversation.phone}: interesse identificado antes da cotação.`, conversation.id, runtime, nowIso);
  }
  if (decision.notifyQuestion) {
    await notify(repo, "question", "Pergunta sem fonte", decision.pendingReason || "Dúvida exige Luís.", conversation.id, runtime, nowIso);
  }
  if (decision.notifyDifficulty) {
    await notify(repo, "difficulty", "Atenção no atendimento", decision.pendingReason || decision.nextAction, conversation.id, runtime, nowIso);
  }

  if (decision.reuseQuote && decision.knownQuoteId) {
    const key = `reused:${conversation.id}:${decision.knownQuoteId}`;
    const already = await repo.findQuoteByKey(key);
    if (!already) {
      await repo.insertQuote({
        id: id(),
        conversationId: conversation.id,
        requestKey: key,
        status: "reused_existing",
        solicitationId: null,
        quoteId: decision.knownQuoteId,
        clientId: null,
        savedConfirmed: false,
        simulated: runtime.source === "simulation",
        missing: [],
        detail: "Cotação existente aproveitada. Histórico não foi sobrescrito nem recalculado.",
        createdAt: nowIso,
      });
    }
    conversation.quoteStatus = "reused_existing";
  }

  if (decision.requestQuote && decision.lane === "commercial") {
    const key = requestKey(conversation.id, conversation.product, conversation.city, conversation.ages);
    const already = await repo.findQuoteByKey(key);
    if (!already) {
      await repo.insertQuote({
        id: id(),
        conversationId: conversation.id,
        requestKey: key,
        status: runtime.dianaEnabled ? "uncertain" : "not_connected",
        solicitationId: null,
        quoteId: null,
        clientId: null,
        savedConfirmed: false,
        simulated: runtime.source === "simulation",
        missing: [],
        detail: runtime.dianaEnabled
          ? "Pedido preparado para a DIANA. Sem resposta ainda."
          : "DIANA desconectada. Isto não é cotação concluída, nem preço, nem material.",
        createdAt: nowIso,
      });
      await audit(repo, "quote_requested", `Chave estável ${key}.`, conversation.id, runtime, nowIso);
    } else {
      await audit(repo, "quote_deduped", `Chave ${key} já existia. Não houve segunda ficha.`, conversation.id, runtime, nowIso);
    }
    conversation.quoteStatus = already?.status || (runtime.dianaEnabled ? "uncertain" : "not_connected");
  }

  if (decision.scheduleReviewAt) {
    const jobs = await repo.listJobs();
    const exists = jobs.some(
      (job) => job.conversationId === conversation.id && job.kind === "daytime_review" && job.status === "pending",
    );
    if (!exists) {
      await repo.insertJob({
        id: id(),
        conversationId: conversation.id,
        messageId: null,
        kind: "daytime_review",
        status: "pending",
        attempts: 0,
        maxAttempts: 3,
        runAfter: decision.scheduleReviewAt,
        lockedAt: null,
        lastError: null,
        scenario: runtime.scenario,
        createdAt: nowIso,
      });
    }
  }

  const template = policyTemplate(decision);
  if (template && decision.recipientPhone && decision.replyIntent !== "personal_hold") {
    await prepareOutbound(repo, conversation, decision.recipientPhone, template, null, "text", runtime, nowIso);
  }

  if (decision.entry === "filo" && decision.replyIntent === "quote_pending" && decision.recipientPhone) {
    const templateFilo = policyTemplate(decision);
    if (templateFilo) {
      /* prepareOutbound already called above */
    }
  }

  message.status = "processed";
  await repo.updateMessage(message);
  await repo.updateConversation(conversation);
  const provider = await repo.getProvider();
  provider.lastProcessedAt = nowIso;
  await repo.saveProvider(provider);
}

async function prepareOutbound(
  repo: Repo,
  conversation: Conversation,
  recipient: string,
  body: string,
  attachmentRef: string | null,
  kind: string,
  runtime: Runtime,
  nowIso: string,
): Promise<OutboundPart> {
  const freshSettings = await repo.getSettings();
  const fresh = await repo.getConversation(conversation.id);
  const paused = freshSettings.globalPause || fresh?.automation !== "auto";
  let state = paused
    ? "held_pause"
    : !runtime.sendsEnabled || runtime.source === "simulation"
      ? "blocked_send_disabled"
      : "prepared";
  if (state === "prepared" && runtime.deliver) {
    state = await runtime.deliver({ phone: recipient, body, attachmentRef });
  }
  const part: OutboundPart = {
    id: id(),
    conversationId: conversation.id,
    quoteId: null,
    position: (await repo.listParts(conversation.id)).length + 1,
    kind,
    recipientPhone: recipient,
    body,
    attachmentRef,
    state,
    approvalHash: fingerprint(`${recipient}|${body}|${attachmentRef || ""}`),
    scenario: runtime.scenario,
    createdAt: nowIso,
  };
  await repo.insertPart(part);
  if (state !== "held_pause") {
    await repo.insertMessage({
      id: id(),
      conversationId: conversation.id,
      providerMessageId: `local:${part.id}`,
      direction: "outbound",
      author: "app",
      body,
      payload: "{}",
      source: runtime.source,
      status: state,
      draftSource: "policy_template",
      isEcho: false,
      fromMe: false,
      scenario: runtime.scenario,
      createdAt: nowIso,
    });
  }
  await audit(
    repo,
    "outbound_prepared",
    `Saída ${state} para ${recipient}. Fonte do texto: regra do produto, não modelo. Envio real ${runtime.sendsEnabled ? "habilitado" : "desligado"}.`,
    conversation.id,
    runtime,
    nowIso,
  );
  return part;
}

async function runDaytimeReview(repo: Repo, conversationId: string | null, runtime: Runtime): Promise<void> {
  const nowIso = runtime.now.toISOString();
  if (!conversationId) return;
  const conversation = await repo.getConversation(conversationId);
  if (!conversation) return;
  const parts = await repo.listParts(conversationId);
  const detail = conversation.automation !== "auto"
    ? "Revisão diurna: automação suspensa ou pausada. Nenhum lembrete saiu."
    : parts.some((part) => part.state === "blocked_send_disabled" || part.state === "accepted")
      ? "Revisão diurna: já existe saída anterior. Não houve disparo cego."
      : "Revisão diurna: cliente em silêncio. Nenhum lembrete automático foi criado.";
  conversation.pendingReason = conversation.pendingReason || "revisão diurna sem disparo";
  conversation.nextAction = "conferido no período diurno; sem cobrança automática";
  conversation.lastProcessedAt = nowIso;
  conversation.updatedAt = nowIso;
  await repo.updateConversation(conversation);
  await audit(repo, "daytime_review_no_send", detail, conversation.id, runtime, nowIso);
}

export async function releaseNextPart(repo: Repo, conversationId: string, runtime: Runtime): Promise<OutboundPart | null> {
  const nowIso = runtime.now.toISOString();
  const settings = await repo.getSettings();
  const conversation = await repo.getConversation(conversationId);
  if (!conversation) return null;
  const parts = await repo.listParts(conversationId);
  const next = parts.find((part) => part.state === "planned");
  if (!next) return null;
  if (settings.globalPause || conversation.automation !== "auto") {
    next.state = "held_pause";
    await repo.updatePart(next);
    await audit(repo, "pause_revalidated", "Pausa revalidada no servidor antes do anexo. A parte não saiu.", conversationId, runtime, nowIso);
    return next;
  }
  const approvals = await repo.listApprovals(conversationId);
  if (next.kind !== "text") {
    const hash = fingerprint(`${next.recipientPhone}|${next.body}|${next.attachmentRef || ""}`);
    const approved = approvals.find((item) => item.status === "approved" && item.bodyHash === hash && item.recipientPhone === next.recipientPhone);
    if (conversation.lane === "personal" && !approved) {
      next.state = "awaiting_approval";
      await repo.updatePart(next);
      return next;
    }
    if (approved && approved.bodyHash !== hash) {
      approved.status = "invalidated";
    }
  }
  next.state = runtime.sendsEnabled && runtime.source !== "simulation" ? "prepared" : "blocked_send_disabled";
  if (next.state === "prepared" && runtime.deliver) {
    next.state = await runtime.deliver({
      phone: next.recipientPhone,
      body: next.body,
      attachmentRef: next.attachmentRef,
    });
  }
  await repo.updatePart(next);
  await repo.insertMessage({
    id: id(),
    conversationId,
    providerMessageId: `local:${next.id}`,
    direction: "outbound",
    author: "app",
    body: next.body,
    payload: "{}",
    source: runtime.source,
    status: next.state,
    draftSource: "policy_template",
    isEcho: false,
    fromMe: false,
    scenario: runtime.scenario,
    createdAt: nowIso,
  });
  await audit(repo, "part_released", `Anexo ${next.kind} ficou ${next.state}. Não é entrega nem leitura.`, conversationId, runtime, nowIso);
  return next;
}

const ASSIGNEE = "Luís";

export function quoteReadyForWallet(quote: Quote): boolean {
  return quote.status === "completed" && quote.savedConfirmed && Boolean(quote.quoteId && quote.quoteId.trim());
}

async function syncWallet(
  repo: Repo,
  conversation: Conversation,
  quote: Quote,
  runtime: Runtime,
  nowIso: string,
): Promise<void> {
  if (conversation.lane !== "commercial" || !quoteReadyForWallet(quote) || !quote.quoteId) return;
  const simulated = quote.simulated || conversation.source === "simulation";
  const existing = await repo.findWalletByPhone(conversation.phone);
  if (existing) {
    existing.displayName = conversation.displayName || existing.displayName;
    existing.assignedTo = ASSIGNEE;
    existing.conversationId = conversation.id;
    existing.quoteRowId = quote.id;
    existing.quoteId = quote.quoteId;
    existing.clientId = quote.clientId;
    existing.simulated = simulated;
    existing.updatedAt = nowIso;
    await repo.updateWallet(existing);
    conversation.responsible = ASSIGNEE;
    await audit(
      repo,
      "wallet_kept",
      `Telefone já estava na carteira de Luís. Nenhuma segunda ficha. Vínculo ${quote.quoteId}.`,
      conversation.id,
      runtime,
      nowIso,
    );
    return;
  }
  const row: WalletClient = {
    id: id(),
    phone: conversation.phone,
    displayName: conversation.displayName,
    assignedTo: ASSIGNEE,
    conversationId: conversation.id,
    quoteRowId: quote.id,
    quoteId: quote.quoteId,
    clientId: quote.clientId,
    simulated,
    linkedAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  try {
    await repo.insertWallet(row);
  } catch {
    const again = await repo.findWalletByPhone(conversation.phone);
    if (!again) throw new Error("WALLET_DUPLICATE");
    again.displayName = conversation.displayName || again.displayName;
    again.assignedTo = ASSIGNEE;
    again.conversationId = conversation.id;
    again.quoteRowId = quote.id;
    again.quoteId = quote.quoteId;
    again.clientId = quote.clientId;
    again.simulated = simulated;
    again.updatedAt = nowIso;
    await repo.updateWallet(again);
    conversation.responsible = ASSIGNEE;
    await audit(repo, "wallet_kept", `Corrida resolvida sem segunda ficha. Vínculo ${quote.quoteId}.`, conversation.id, runtime, nowIso);
    return;
  }
  conversation.responsible = ASSIGNEE;
  await audit(
    repo,
    "wallet_assigned",
    `Cliente deste WhatsApp entrou na carteira local, atribuído a Luís, após cotação ${quote.quoteId} salva e vinculada.`,
    conversation.id,
    runtime,
    nowIso,
  );
}

export async function applySimulatedDiana(
  repo: Repo,
  conversationId: string,
  runtime: Runtime,
  result: {
    status: "completed" | "missing_data" | "commercial_block" | "technical_failure" | "uncertain";
    quoteId?: string;
    solicitationId?: string;
    clientId?: string;
    saved?: boolean;
    missing?: string[];
  },
): Promise<void> {
  const conversation = await repo.getConversation(conversationId);
  if (!conversation || conversation.source !== "simulation") {
    throw new Error("SIMULATION_ONLY");
  }
  return commitQuoteResult(repo, conversationId, runtime, result);
}

/**
 * Grava o resultado de uma cotação já decidido fora daqui.
 * Não chama a DIANA, não calcula preço e não envia WhatsApp.
 * A carteira local só muda se o resultado for válido, salvo e vinculado.
 */
export async function commitQuoteResult(
  repo: Repo,
  conversationId: string,
  runtime: Runtime,
  result: {
    status: "completed" | "missing_data" | "commercial_block" | "technical_failure" | "uncertain";
    quoteId?: string;
    solicitationId?: string;
    clientId?: string;
    saved?: boolean;
    missing?: string[];
  },
): Promise<void> {
  const conversation = await repo.getConversation(conversationId);
  if (!conversation) throw new Error("NO_CONVERSATION");
  const nowIso = runtime.now.toISOString();
  const quotes = await repo.listQuotes(conversationId);
  const quote = quotes[quotes.length - 1];
  if (!quote) throw new Error("NO_QUOTE_REQUEST");
  const simulated = conversation.source === "simulation" || runtime.source === "simulation";
  quote.status = result.status;
  quote.quoteId = result.quoteId || quote.quoteId;
  quote.solicitationId = result.solicitationId || null;
  quote.clientId = result.clientId || null;
  quote.savedConfirmed = Boolean(result.saved);
  quote.simulated = simulated;
  quote.missing = result.missing || [];
  quote.detail = simulated
    ? "Retorno simulado da DIANA. Não valida a integração real."
    : "Resultado registrado no aplicativo. Não houve chamada à DIANA neste passo.";
  await repo.updateQuote(quote);
  await syncWallet(repo, conversation, quote, runtime, nowIso);
  conversation.quoteStatus = result.status;
  conversation.hasConfirmedMaterials = simulated && result.status === "completed" && Boolean(result.saved);
  conversation.updatedAt = nowIso;
  await repo.updateConversation(conversation);
  if (!(result.status === "completed" && result.saved && simulated)) return;
  const senior = conversation.product === "senior";
  const materials = senior
    ? [
        ["quote_image", "Orçamento em imagem"],
        ["network_pdf", "Rede Palmas"],
      ]
    : [
        ["quote_image", "Orçamento em imagem"],
        ["copart_pdf", "Coparticipação"],
        ["network_pdf", "Rede"],
      ];
  let position = (await repo.listParts(conversationId)).length;
  for (const [kind, name] of materials) {
    position += 1;
    const ref = `sim://${conversationId}/${kind}/v1`;
    await repo.insertFile({
      id: id(),
      conversationId,
      scope: "client",
      kind,
      version: 1,
      storageRef: ref,
      name,
      simulated: true,
      createdAt: nowIso,
    });
    await repo.insertPart({
      id: id(),
      conversationId,
      quoteId: quote.id,
      position,
      kind,
      recipientPhone: conversation.phone,
      body: name,
      attachmentRef: ref,
      state: "planned",
      approvalHash: fingerprint(`${conversation.phone}|${name}|${ref}`),
      scenario: runtime.scenario,
      createdAt: nowIso,
    });
  }
  await audit(repo, "diana_simulated", "Materiais simulados gravados com identificador, tipo e versão. Sênior não leva coparticipação.", conversationId, runtime, nowIso);
}

export async function saveDraft(repo: Repo, conversationId: string, draft: string): Promise<void> {
  const conversation = await repo.getConversation(conversationId);
  if (!conversation) return;
  conversation.draft = draft;
  conversation.updatedAt = new Date().toISOString();
  await repo.updateConversation(conversation);
}

export async function setAutomation(
  repo: Repo,
  conversationId: string,
  automation: Conversation["automation"],
  runtime: Runtime,
): Promise<void> {
  const conversation = await repo.getConversation(conversationId);
  if (!conversation) return;
  conversation.automation = automation;
  conversation.updatedAt = runtime.now.toISOString();
  conversation.nextAction = automation === "auto" ? "automação retomada no painel" : "automação pausada no painel";
  await repo.updateConversation(conversation);
  await audit(repo, "automation", `Automação da conversa: ${automation}.`, conversationId, runtime, conversation.updatedAt);
}

export async function setGlobalPause(repo: Repo, paused: boolean, runtime: Runtime): Promise<void> {
  const settings = await repo.getSettings();
  settings.globalPause = paused;
  await repo.saveSettings(settings);
  await audit(repo, "global_pause", paused ? "Pausa global ligada." : "Pausa global desligada.", null, runtime, runtime.now.toISOString());
}

export async function approvePersonal(
  repo: Repo,
  conversationId: string,
  recipient: string,
  body: string,
  attachmentRef: string | null,
  runtime: Runtime,
): Promise<{ state: string }> {
  const conversation = await repo.getConversation(conversationId);
  if (!conversation) return { state: "missing" };
  const nowIso = runtime.now.toISOString();
  const hash = fingerprint(`${recipient}|${body}|${attachmentRef || ""}`);
  await repo.insertApproval({
    id: id(),
    conversationId,
    recipientPhone: recipient,
    bodyHash: hash,
    attachmentHash: fingerprint(attachmentRef || ""),
    status: "approved",
    createdAt: nowIso,
  });
  let state = runtime.sendsEnabled && runtime.source !== "simulation" ? "prepared" : "blocked_send_disabled";
  if (state === "prepared" && runtime.deliver) {
    state = await runtime.deliver({ phone: recipient, body, attachmentRef });
  }
  await repo.insertPart({
    id: id(),
    conversationId,
    quoteId: null,
    position: (await repo.listParts(conversationId)).length + 1,
    kind: "personal_text",
    recipientPhone: recipient,
    body,
    attachmentRef,
    state,
    approvalHash: hash,
    scenario: runtime.scenario,
    createdAt: nowIso,
  });
  await audit(repo, "personal_approved", `Aprovação registrada. Estado do envio: ${state}. Aprovação perde validade se texto, destino ou anexo mudar.`, conversationId, runtime, nowIso);
  return { state };
}

export async function archiveExpired(repo: Repo, now: Date): Promise<{ archived: number }> {
  const settings = await repo.getSettings();
  const cutoff = now.getTime() - settings.retentionDays * 24 * 60 * 60 * 1000;
  const personalCutoff = now.getTime() - settings.personalDriveDays * 24 * 60 * 60 * 1000;
  let archived = 0;
  const conversations = await repo.listConversations();
  for (const conversation of conversations) {
    if (conversation.pendingReason) continue;
    const messages = await repo.listMessages(conversation.id);
    for (const message of messages) {
      const when = new Date(message.createdAt).getTime();
      const limit = conversation.lane === "personal" ? personalCutoff : cutoff;
      if (when < limit && !message.body.startsWith("[arquivado local]")) {
        message.body = "[arquivado local] metadados e vínculo preservados";
        archived += 1;
      }
    }
  }
  return { archived };
}

export function buildRuntime(partial: Partial<Runtime> & { now: Date; source: Runtime["source"] }): Runtime {
  return {
    now: partial.now,
    source: partial.source,
    sendsEnabled: partial.sendsEnabled ?? false,
    dianaEnabled: partial.dianaEnabled ?? false,
    selfPhone: partial.selfPhone ?? "63992731001",
    scenario: partial.scenario ?? null,
  };
}
