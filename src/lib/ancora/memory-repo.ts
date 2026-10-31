import type { Repo } from "./repo.ts";
import type {
  Approval,
  Audit,
  Conversation,
  Job,
  Message,
  ModuleNote,
  Notice,
  OutboundPart,
  ProviderState,
  Quote,
  Settings,
  StoredFile,
  WalletClient,
} from "./types.ts";
import { defaultProvider, defaultSettings } from "./types.ts";

export class MemoryRepo implements Repo {
  settings: Settings = defaultSettings();
  provider: ProviderState = defaultProvider();
  conversations: Conversation[] = [];
  messages: Message[] = [];
  jobs: Job[] = [];
  quotes: Quote[] = [];
  parts: OutboundPart[] = [];
  notices: Notice[] = [];
  audits: Audit[] = [];
  files: StoredFile[] = [];
  approvals: Approval[] = [];
  notes: ModuleNote[] = [];
  wallet: WalletClient[] = [];

  async getSettings() {
    return this.settings;
  }
  async saveSettings(settings: Settings) {
    this.settings = settings;
  }
  async getProvider() {
    return this.provider;
  }
  async saveProvider(state: ProviderState) {
    this.provider = state;
  }
  async findConversationByPhone(phone: string) {
    return this.conversations.find((row) => row.phone === phone) ?? null;
  }
  async getConversation(id: string) {
    return this.conversations.find((row) => row.id === id) ?? null;
  }
  async listConversations() {
    return [...this.conversations];
  }
  async insertConversation(row: Conversation) {
    this.conversations.push(row);
  }
  async updateConversation(row: Conversation) {
    const index = this.conversations.findIndex((item) => item.id === row.id);
    if (index >= 0) this.conversations[index] = row;
  }
  async findMessageByProvider(providerMessageId: string) {
    return this.messages.find((row) => row.providerMessageId === providerMessageId) ?? null;
  }
  async listMessages(conversationId: string) {
    return this.messages.filter((row) => row.conversationId === conversationId);
  }
  async insertMessage(row: Message) {
    this.messages.push(row);
  }
  async updateMessage(row: Message) {
    const index = this.messages.findIndex((item) => item.id === row.id);
    if (index >= 0) this.messages[index] = row;
  }
  async insertJob(row: Job) {
    this.jobs.push(row);
  }
  async listJobs() {
    return [...this.jobs];
  }
  async updateJob(row: Job) {
    const index = this.jobs.findIndex((item) => item.id === row.id);
    if (index >= 0) this.jobs[index] = row;
  }
  async findQuoteByKey(requestKey: string) {
    return this.quotes.find((row) => row.requestKey === requestKey) ?? null;
  }
  async listQuotes(conversationId: string) {
    return this.quotes.filter((row) => row.conversationId === conversationId);
  }
  async insertQuote(row: Quote) {
    this.quotes.push(row);
  }
  async updateQuote(row: Quote) {
    const index = this.quotes.findIndex((item) => item.id === row.id);
    if (index >= 0) this.quotes[index] = row;
  }
  async listParts(conversationId: string) {
    return this.parts
      .filter((row) => row.conversationId === conversationId)
      .sort((a, b) => a.position - b.position);
  }
  async insertPart(row: OutboundPart) {
    this.parts.push(row);
  }
  async updatePart(row: OutboundPart) {
    const index = this.parts.findIndex((item) => item.id === row.id);
    if (index >= 0) this.parts[index] = row;
  }
  async insertNotice(row: Notice) {
    this.notices.push(row);
  }
  async listNotices() {
    return [...this.notices];
  }
  async markNoticeRead(id: string, readAt: string) {
    const notice = this.notices.find((row) => row.id === id);
    if (notice) notice.readAt = readAt;
  }
  async insertAudit(row: Audit) {
    this.audits.push(row);
  }
  async listAudits(conversationId?: string) {
    return this.audits.filter((row) => !conversationId || row.conversationId === conversationId);
  }
  async insertFile(row: StoredFile) {
    this.files.push(row);
  }
  async listFiles() {
    return [...this.files];
  }
  async insertApproval(row: Approval) {
    this.approvals.push(row);
  }
  async listApprovals(conversationId: string) {
    return this.approvals.filter((row) => row.conversationId === conversationId);
  }
  async invalidateApprovals(conversationId: string) {
    for (const approval of this.approvals) {
      if (approval.conversationId === conversationId && approval.status === "approved") {
        approval.status = "invalidated";
      }
    }
  }
  async insertNote(row: ModuleNote) {
    this.notes.push(row);
  }
  async listNotes() {
    return [...this.notes];
  }
  async findWalletByPhone(phone: string) {
    return this.wallet.find((row) => row.phone === phone) ?? null;
  }
  async listWallet() {
    return [...this.wallet].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
  async insertWallet(row: WalletClient) {
    if (this.wallet.some((item) => item.phone === row.phone)) {
      throw new Error("WALLET_DUPLICATE");
    }
    this.wallet.push(row);
  }
  async updateWallet(row: WalletClient) {
    const index = this.wallet.findIndex((item) => item.id === row.id);
    if (index >= 0) this.wallet[index] = row;
  }
  async clearSimulation() {
    const ids = new Set(
      this.conversations.filter((row) => row.source === "simulation").map((row) => row.id),
    );
    this.conversations = this.conversations.filter((row) => row.source !== "simulation");
    this.messages = this.messages.filter((row) => row.source !== "simulation" && !ids.has(row.conversationId));
    this.jobs = this.jobs.filter((row) => row.scenario == null);
    this.quotes = this.quotes.filter((row) => !ids.has(row.conversationId));
    this.parts = this.parts.filter((row) => row.scenario == null);
    this.notices = this.notices.filter((row) => row.scenario == null);
    this.audits = this.audits.filter((row) => row.scenario == null);
    this.files = this.files.filter((row) => !row.simulated);
    this.wallet = this.wallet.filter((row) => !row.simulated);
    this.notes = [];
  }
}
