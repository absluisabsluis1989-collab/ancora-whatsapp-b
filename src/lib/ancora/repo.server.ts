import { getSql, type Sql } from "@/lib/db";
import type { Repo } from "./repo.ts";
import {
  defaultProvider,
  defaultSettings,
  GAP_NOTE,
  type Approval,
  type Audit,
  type Conversation,
  type Job,
  type Message,
  type ModuleNote,
  type Notice,
  type OutboundPart,
  type ProviderState,
  type Quote,
  type Settings,
  type Source,
  type StoredFile,
  type WalletClient,
} from "./types.ts";

type Row = Record<string, unknown>;

function text(value: unknown): string | null {
  if (value == null) return null;
  return String(value);
}

function bool(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value || 0);
}

function ages(value: unknown): number[] {
  try {
    const parsed = JSON.parse(String(value || "[]")) as unknown;
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

function conversation(row: Row): Conversation {
  return {
    id: String(row.id),
    phone: String(row.phone),
    source: row.source as Source,
    displayName: text(row.display_name),
    namePending: bool(row.name_pending),
    lane: row.lane as Conversation["lane"],
    entry: row.entry as Conversation["entry"],
    product: text(row.product),
    city: text(row.city),
    ages: ages(row.ages_json),
    profession: text(row.profession),
    campaignRef: text(row.campaign_ref),
    originConfirmed: bool(row.origin_confirmed),
    stage: String(row.stage),
    automation: row.automation as Conversation["automation"],
    responsible: String(row.responsible),
    customerHasSpoken: bool(row.customer_has_spoken),
    interestNotified: bool(row.interest_notified),
    draft: String(row.draft || ""),
    pendingReason: text(row.pending_reason),
    nextAction: String(row.next_action || ""),
    lastInboundAt: text(row.last_inbound_at),
    lastProcessedAt: text(row.last_processed_at),
    quoteStatus: text(row.quote_status),
    hasConfirmedMaterials: bool(row.has_confirmed_materials),
    knownQuoteId: text(row.known_quote_id),
    scenario: text(row.scenario),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function message(row: Row): Message {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    providerMessageId: String(row.provider_message_id),
    direction: row.direction as Message["direction"],
    author: row.author as Message["author"],
    body: String(row.body),
    payload: String(row.payload || "{}"),
    source: row.source as Source,
    status: String(row.status),
    draftSource: row.draft_source as Message["draftSource"],
    isEcho: bool(row.is_echo),
    fromMe: bool(row.from_me),
    scenario: text(row.scenario),
    createdAt: String(row.created_at),
  };
}

export async function claimWorkspace(userId: string): Promise<{ ok: boolean }> {
  const sql = await getSql();
  const now = new Date().toISOString();
  const existing = await sql<{ owner_user_id: string }>`select owner_user_id from workspace_binding where id = 'b'`;
  if (existing.length === 0) {
    try {
      await sql`insert into workspace_binding (id, owner_user_id, claimed_at) values ('b', ${userId}, ${now})`;
    } catch {
      const retry = await sql<{ owner_user_id: string }>`select owner_user_id from workspace_binding where id = 'b'`;
      return { ok: retry[0]?.owner_user_id === userId };
    }
  } else if (existing[0].owner_user_id !== userId) {
    return { ok: false };
  }
  await sql`insert into settings (
    owner_user_id, global_pause, retention_days, personal_drive_days, window_start, window_end, model_calls_date, model_calls, updated_at
  ) values (${userId}, false, 365, 5, '08:00', '18:00', '', 0, ${now})
  on conflict (owner_user_id) do nothing`;
  await sql`insert into provider_state (
    owner_user_id, connection, gap_note, updated_at
  ) values (${userId}, 'not_connected', ${GAP_NOTE}, ${now})
  on conflict (owner_user_id) do nothing`;
  return { ok: true };
}

export function createDbRepo(owner: string): Repo {
  return {
    async getSettings() {
      const sql = await getSql();
      const rows = await sql<Row>`select * from settings where owner_user_id = ${owner}`;
      const row = rows[0];
      if (!row) return defaultSettings();
      return {
        globalPause: bool(row.global_pause),
        retentionDays: num(row.retention_days),
        personalDriveDays: num(row.personal_drive_days),
        windowStart: String(row.window_start),
        windowEnd: String(row.window_end),
        modelCallsDate: String(row.model_calls_date || ""),
        modelCalls: num(row.model_calls),
      };
    },
    async saveSettings(settings: Settings) {
      const sql = await getSql();
      const now = new Date().toISOString();
      await sql`update settings set
        global_pause = ${settings.globalPause},
        retention_days = ${settings.retentionDays},
        personal_drive_days = ${settings.personalDriveDays},
        window_start = ${settings.windowStart},
        window_end = ${settings.windowEnd},
        model_calls_date = ${settings.modelCallsDate},
        model_calls = ${settings.modelCalls},
        updated_at = ${now}
      where owner_user_id = ${owner}`;
    },
    async getProvider() {
      const sql = await getSql();
      const rows = await sql<Row>`select * from provider_state where owner_user_id = ${owner}`;
      const row = rows[0];
      if (!row) return defaultProvider();
      return {
        connection: row.connection as ProviderState["connection"],
        lastWebhookAt: text(row.last_webhook_at),
        lastReceivedAt: text(row.last_received_at),
        lastProcessedAt: text(row.last_processed_at),
        gapNote: String(row.gap_note || GAP_NOTE),
      };
    },
    async saveProvider(state: ProviderState) {
      const sql = await getSql();
      await sql`update provider_state set
        connection = ${state.connection},
        last_webhook_at = ${state.lastWebhookAt},
        last_received_at = ${state.lastReceivedAt},
        last_processed_at = ${state.lastProcessedAt},
        gap_note = ${state.gapNote},
        updated_at = ${new Date().toISOString()}
      where owner_user_id = ${owner}`;
    },
    async findConversationByPhone(phone: string) {
      const sql = await getSql();
      const rows = await sql<Row>`select * from conversations where owner_user_id = ${owner} and phone = ${phone}`;
      return rows[0] ? conversation(rows[0]) : null;
    },
    async getConversation(id: string) {
      const sql = await getSql();
      const rows = await sql<Row>`select * from conversations where owner_user_id = ${owner} and id = ${id}`;
      return rows[0] ? conversation(rows[0]) : null;
    },
    async listConversations() {
      const sql = await getSql();
      const rows = await sql<Row>`select * from conversations where owner_user_id = ${owner} order by updated_at desc`;
      return rows.map(conversation);
    },
    async insertConversation(row: Conversation) {
      const sql = await getSql();
      await writeConversation(sql, owner, row, true);
    },
    async updateConversation(row: Conversation) {
      const sql = await getSql();
      await writeConversation(sql, owner, row, false);
    },
    async findMessageByProvider(providerMessageId: string) {
      const sql = await getSql();
      const rows = await sql<Row>`select * from messages where owner_user_id = ${owner} and provider_message_id = ${providerMessageId}`;
      return rows[0] ? message(rows[0]) : null;
    },
    async listMessages(conversationId: string) {
      const sql = await getSql();
      const rows = await sql<Row>`select * from messages where owner_user_id = ${owner} and conversation_id = ${conversationId} order by created_at`;
      return rows.map(message);
    },
    async insertMessage(row: Message) {
      const sql = await getSql();
      await sql`insert into messages (
        id, owner_user_id, conversation_id, provider_message_id, direction, author, body, payload, source, status, draft_source, is_echo, from_me, scenario, created_at
      ) values (
        ${row.id}, ${owner}, ${row.conversationId}, ${row.providerMessageId}, ${row.direction}, ${row.author}, ${row.body}, ${row.payload}, ${row.source}, ${row.status}, ${row.draftSource}, ${row.isEcho}, ${row.fromMe}, ${row.scenario}, ${row.createdAt}
      )`;
    },
    async updateMessage(row: Message) {
      const sql = await getSql();
      await sql`update messages set body = ${row.body}, status = ${row.status}, draft_source = ${row.draftSource}
        where owner_user_id = ${owner} and id = ${row.id}`;
    },
    async insertJob(row: Job) {
      const sql = await getSql();
      await sql`insert into jobs (
        id, owner_user_id, conversation_id, message_id, kind, status, attempts, max_attempts, run_after, locked_at, last_error, scenario, created_at
      ) values (
        ${row.id}, ${owner}, ${row.conversationId}, ${row.messageId}, ${row.kind}, ${row.status}, ${row.attempts}, ${row.maxAttempts}, ${row.runAfter}, ${row.lockedAt}, ${row.lastError}, ${row.scenario}, ${row.createdAt}
      )`;
    },
    async listJobs() {
      const sql = await getSql();
      const rows = await sql<Row>`select * from jobs where owner_user_id = ${owner} order by created_at`;
      return rows.map((row) => ({
        id: String(row.id),
        conversationId: text(row.conversation_id),
        messageId: text(row.message_id),
        kind: String(row.kind),
        status: row.status as Job["status"],
        attempts: num(row.attempts),
        maxAttempts: num(row.max_attempts),
        runAfter: String(row.run_after),
        lockedAt: text(row.locked_at),
        lastError: text(row.last_error),
        scenario: text(row.scenario),
        createdAt: String(row.created_at),
      }));
    },
    async updateJob(row: Job) {
      const sql = await getSql();
      await sql`update jobs set status = ${row.status}, attempts = ${row.attempts}, locked_at = ${row.lockedAt}, last_error = ${row.lastError}
        where owner_user_id = ${owner} and id = ${row.id}`;
    },
    async findQuoteByKey(requestKey: string) {
      const sql = await getSql();
      const rows = await sql<Row>`select * from quotes where owner_user_id = ${owner} and request_key = ${requestKey}`;
      return rows[0] ? quote(rows[0]) : null;
    },
    async listQuotes(conversationId: string) {
      const sql = await getSql();
      const rows = await sql<Row>`select * from quotes where owner_user_id = ${owner} and conversation_id = ${conversationId} order by created_at`;
      return rows.map(quote);
    },
    async insertQuote(row: Quote) {
      const sql = await getSql();
      await sql`insert into quotes (
        id, owner_user_id, conversation_id, request_key, status, solicitation_id, quote_id, client_id, saved_confirmed, simulated, missing_json, detail, created_at
      ) values (
        ${row.id}, ${owner}, ${row.conversationId}, ${row.requestKey}, ${row.status}, ${row.solicitationId}, ${row.quoteId}, ${row.clientId}, ${row.savedConfirmed}, ${row.simulated}, ${JSON.stringify(row.missing)}, ${row.detail}, ${row.createdAt}
      )`;
    },
    async updateQuote(row: Quote) {
      const sql = await getSql();
      await sql`update quotes set status = ${row.status}, solicitation_id = ${row.solicitationId}, quote_id = ${row.quoteId}, client_id = ${row.clientId}, saved_confirmed = ${row.savedConfirmed}, simulated = ${row.simulated}, missing_json = ${JSON.stringify(row.missing)}, detail = ${row.detail}
        where owner_user_id = ${owner} and id = ${row.id}`;
    },
    async listParts(conversationId: string) {
      const sql = await getSql();
      const rows = await sql<Row>`select * from outbound_parts where owner_user_id = ${owner} and conversation_id = ${conversationId} order by position`;
      return rows.map(part);
    },
    async insertPart(row: OutboundPart) {
      const sql = await getSql();
      await sql`insert into outbound_parts (
        id, owner_user_id, conversation_id, quote_id, position, kind, recipient_phone, body, attachment_ref, state, approval_hash, scenario, created_at
      ) values (
        ${row.id}, ${owner}, ${row.conversationId}, ${row.quoteId}, ${row.position}, ${row.kind}, ${row.recipientPhone}, ${row.body}, ${row.attachmentRef}, ${row.state}, ${row.approvalHash}, ${row.scenario}, ${row.createdAt}
      )`;
    },
    async updatePart(row: OutboundPart) {
      const sql = await getSql();
      await sql`update outbound_parts set state = ${row.state}, approval_hash = ${row.approvalHash}
        where owner_user_id = ${owner} and id = ${row.id}`;
    },
    async insertNotice(row: Notice) {
      const sql = await getSql();
      await sql`insert into notifications (
        id, owner_user_id, conversation_id, kind, title, body, read_at, scenario, created_at
      ) values (
        ${row.id}, ${owner}, ${row.conversationId}, ${row.kind}, ${row.title}, ${row.body}, ${row.readAt}, ${row.scenario}, ${row.createdAt}
      )`;
    },
    async listNotices() {
      const sql = await getSql();
      const rows = await sql<Row>`select * from notifications where owner_user_id = ${owner} order by created_at desc`;
      return rows.map((row) => ({
        id: String(row.id),
        conversationId: text(row.conversation_id),
        kind: row.kind as Notice["kind"],
        title: String(row.title),
        body: String(row.body),
        readAt: text(row.read_at),
        scenario: text(row.scenario),
        createdAt: String(row.created_at),
      }));
    },
    async markNoticeRead(id: string, readAt: string) {
      const sql = await getSql();
      await sql`update notifications set read_at = ${readAt} where owner_user_id = ${owner} and id = ${id}`;
    },
    async insertAudit(row: Audit) {
      const sql = await getSql();
      await sql`insert into audit_events (id, owner_user_id, conversation_id, kind, detail, scenario, created_at)
        values (${row.id}, ${owner}, ${row.conversationId}, ${row.kind}, ${row.detail}, ${row.scenario}, ${row.createdAt})`;
    },
    async listAudits(conversationId?: string) {
      const sql = await getSql();
      const rows = conversationId
        ? await sql<Row>`select * from audit_events where owner_user_id = ${owner} and conversation_id = ${conversationId} order by created_at`
        : await sql<Row>`select * from audit_events where owner_user_id = ${owner} order by created_at`;
      return rows.map((row) => ({
        id: String(row.id),
        conversationId: text(row.conversation_id),
        kind: String(row.kind),
        detail: String(row.detail),
        scenario: text(row.scenario),
        createdAt: String(row.created_at),
      }));
    },
    async insertFile(row: StoredFile) {
      const sql = await getSql();
      await sql`insert into stored_files (
        id, owner_user_id, conversation_id, scope, kind, version, storage_ref, name, simulated, created_at
      ) values (
        ${row.id}, ${owner}, ${row.conversationId}, ${row.scope}, ${row.kind}, ${row.version}, ${row.storageRef}, ${row.name}, ${row.simulated}, ${row.createdAt}
      )`;
    },
    async listFiles() {
      const sql = await getSql();
      const rows = await sql<Row>`select * from stored_files where owner_user_id = ${owner} order by created_at desc`;
      return rows.map((row) => ({
        id: String(row.id),
        conversationId: text(row.conversation_id),
        scope: row.scope as StoredFile["scope"],
        kind: String(row.kind),
        version: num(row.version),
        storageRef: String(row.storage_ref),
        name: String(row.name),
        simulated: bool(row.simulated),
        createdAt: String(row.created_at),
      }));
    },
    async insertApproval(row: Approval) {
      const sql = await getSql();
      await sql`insert into approvals (
        id, owner_user_id, conversation_id, recipient_phone, body_hash, attachment_hash, status, created_at
      ) values (
        ${row.id}, ${owner}, ${row.conversationId}, ${row.recipientPhone}, ${row.bodyHash}, ${row.attachmentHash}, ${row.status}, ${row.createdAt}
      )`;
    },
    async listApprovals(conversationId: string) {
      const sql = await getSql();
      const rows = await sql<Row>`select * from approvals where owner_user_id = ${owner} and conversation_id = ${conversationId}`;
      return rows.map((row) => ({
        id: String(row.id),
        conversationId: String(row.conversation_id),
        recipientPhone: String(row.recipient_phone),
        bodyHash: String(row.body_hash),
        attachmentHash: String(row.attachment_hash),
        status: row.status as Approval["status"],
        createdAt: String(row.created_at),
      }));
    },
    async invalidateApprovals(conversationId: string) {
      const sql = await getSql();
      await sql`update approvals set status = 'invalidated' where owner_user_id = ${owner} and conversation_id = ${conversationId} and status = 'approved'`;
    },
    async insertNote(row: ModuleNote) {
      const sql = await getSql();
      await sql`insert into module_notes (id, owner_user_id, module, role, body, created_at)
        values (${row.id}, ${owner}, ${row.module}, ${row.role}, ${row.body}, ${row.createdAt})`;
    },
    async listNotes() {
      const sql = await getSql();
      const rows = await sql<Row>`select * from module_notes where owner_user_id = ${owner} order by created_at`;
      return rows.map((row) => ({
        id: String(row.id),
        module: row.module as ModuleNote["module"],
        role: row.role as ModuleNote["role"],
        body: String(row.body),
        createdAt: String(row.created_at),
      }));
    },
    async findWalletByPhone(phone: string) {
      const sql = await getSql();
      const rows = await sql<Row>`select * from wallet_clients where owner_user_id = ${owner} and phone = ${phone}`;
      return rows[0] ? wallet(rows[0]) : null;
    },
    async listWallet() {
      const sql = await getSql();
      const rows = await sql<Row>`select * from wallet_clients where owner_user_id = ${owner} order by updated_at desc`;
      return rows.map(wallet);
    },
    async insertWallet(row: WalletClient) {
      const sql = await getSql();
      await sql`insert into wallet_clients (
        id, owner_user_id, phone, display_name, assigned_to, conversation_id, quote_row_id, quote_id, client_id, simulated, linked_at, created_at, updated_at
      ) values (
        ${row.id}, ${owner}, ${row.phone}, ${row.displayName}, ${row.assignedTo}, ${row.conversationId}, ${row.quoteRowId},
        ${row.quoteId}, ${row.clientId}, ${row.simulated}, ${row.linkedAt}, ${row.createdAt}, ${row.updatedAt}
      )`;
    },
    async updateWallet(row: WalletClient) {
      const sql = await getSql();
      await sql`update wallet_clients set
        display_name = ${row.displayName},
        assigned_to = ${row.assignedTo},
        conversation_id = ${row.conversationId},
        quote_row_id = ${row.quoteRowId},
        quote_id = ${row.quoteId},
        client_id = ${row.clientId},
        simulated = ${row.simulated},
        updated_at = ${row.updatedAt}
      where owner_user_id = ${owner} and id = ${row.id}`;
    },
    async clearSimulation() {
      const sql = await getSql();
      await sql`delete from messages where owner_user_id = ${owner} and source = 'simulation'`;
      await sql`delete from jobs where owner_user_id = ${owner} and scenario is not null`;
      await sql`delete from quotes where owner_user_id = ${owner} and conversation_id in (select id from conversations where owner_user_id = ${owner} and source = 'simulation')`;
      await sql`delete from outbound_parts where owner_user_id = ${owner} and scenario is not null`;
      await sql`delete from notifications where owner_user_id = ${owner} and scenario is not null`;
      await sql`delete from audit_events where owner_user_id = ${owner} and scenario is not null`;
      await sql`delete from stored_files where owner_user_id = ${owner} and simulated = true`;
      await sql`delete from wallet_clients where owner_user_id = ${owner} and simulated = true`;
      await sql`delete from approvals where owner_user_id = ${owner} and conversation_id in (select id from conversations where owner_user_id = ${owner} and source = 'simulation')`;
      await sql`delete from conversations where owner_user_id = ${owner} and source = 'simulation'`;
    },
  };
}

function wallet(row: Row): WalletClient {
  return {
    id: String(row.id),
    phone: String(row.phone),
    displayName: text(row.display_name),
    assignedTo: String(row.assigned_to),
    conversationId: String(row.conversation_id),
    quoteRowId: String(row.quote_row_id),
    quoteId: String(row.quote_id),
    clientId: text(row.client_id),
    simulated: bool(row.simulated),
    linkedAt: String(row.linked_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function quote(row: Row): Quote {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    requestKey: String(row.request_key),
    status: String(row.status),
    solicitationId: text(row.solicitation_id),
    quoteId: text(row.quote_id),
    clientId: text(row.client_id),
    savedConfirmed: bool(row.saved_confirmed),
    simulated: bool(row.simulated),
    missing: jsonStrings(row.missing_json),
    detail: String(row.detail || ""),
    createdAt: String(row.created_at),
  };
}

function jsonStrings(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value || "[]")) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function part(row: Row): OutboundPart {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    quoteId: text(row.quote_id),
    position: num(row.position),
    kind: String(row.kind),
    recipientPhone: String(row.recipient_phone),
    body: String(row.body),
    attachmentRef: text(row.attachment_ref),
    state: String(row.state),
    approvalHash: text(row.approval_hash),
    scenario: text(row.scenario),
    createdAt: String(row.created_at),
  };
}

async function writeConversation(sql: Sql, owner: string, row: Conversation, insert: boolean) {
  const agesJson = JSON.stringify(row.ages);
  if (insert) {
    await sql`insert into conversations (
      id, owner_user_id, phone, source, display_name, name_pending, lane, entry, product, city, ages_json, profession,
      campaign_ref, origin_confirmed, stage, automation, responsible, customer_has_spoken, interest_notified, draft,
      pending_reason, next_action, last_inbound_at, last_processed_at, quote_status, has_confirmed_materials, known_quote_id,
      scenario, created_at, updated_at
    ) values (
      ${row.id}, ${owner}, ${row.phone}, ${row.source}, ${row.displayName}, ${row.namePending}, ${row.lane}, ${row.entry},
      ${row.product}, ${row.city}, ${agesJson}, ${row.profession}, ${row.campaignRef}, ${row.originConfirmed}, ${row.stage},
      ${row.automation}, ${row.responsible}, ${row.customerHasSpoken}, ${row.interestNotified}, ${row.draft}, ${row.pendingReason},
      ${row.nextAction}, ${row.lastInboundAt}, ${row.lastProcessedAt}, ${row.quoteStatus}, ${row.hasConfirmedMaterials},
      ${row.knownQuoteId}, ${row.scenario}, ${row.createdAt}, ${row.updatedAt}
    )`;
    return;
  }
  await sql`update conversations set
    display_name = ${row.displayName},
    name_pending = ${row.namePending},
    lane = ${row.lane},
    entry = ${row.entry},
    product = ${row.product},
    city = ${row.city},
    ages_json = ${agesJson},
    profession = ${row.profession},
    campaign_ref = ${row.campaignRef},
    origin_confirmed = ${row.originConfirmed},
    stage = ${row.stage},
    automation = ${row.automation},
    responsible = ${row.responsible},
    customer_has_spoken = ${row.customerHasSpoken},
    interest_notified = ${row.interestNotified},
    draft = ${row.draft},
    pending_reason = ${row.pendingReason},
    next_action = ${row.nextAction},
    last_inbound_at = ${row.lastInboundAt},
    last_processed_at = ${row.lastProcessedAt},
    quote_status = ${row.quoteStatus},
    has_confirmed_materials = ${row.hasConfirmedMaterials},
    known_quote_id = ${row.knownQuoteId},
    scenario = ${row.scenario},
    updated_at = ${row.updatedAt}
  where owner_user_id = ${owner} and id = ${row.id}`;
}
