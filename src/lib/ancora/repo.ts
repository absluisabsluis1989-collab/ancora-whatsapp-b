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

export interface Repo {
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  getProvider(): Promise<ProviderState>;
  saveProvider(state: ProviderState): Promise<void>;
  findConversationByPhone(phone: string): Promise<Conversation | null>;
  getConversation(id: string): Promise<Conversation | null>;
  listConversations(): Promise<Conversation[]>;
  insertConversation(row: Conversation): Promise<void>;
  updateConversation(row: Conversation): Promise<void>;
  findMessageByProvider(providerMessageId: string): Promise<Message | null>;
  listMessages(conversationId: string): Promise<Message[]>;
  insertMessage(row: Message): Promise<void>;
  updateMessage(row: Message): Promise<void>;
  insertJob(row: Job): Promise<void>;
  listJobs(): Promise<Job[]>;
  updateJob(row: Job): Promise<void>;
  findQuoteByKey(requestKey: string): Promise<Quote | null>;
  listQuotes(conversationId: string): Promise<Quote[]>;
  insertQuote(row: Quote): Promise<void>;
  updateQuote(row: Quote): Promise<void>;
  listParts(conversationId: string): Promise<OutboundPart[]>;
  insertPart(row: OutboundPart): Promise<void>;
  updatePart(row: OutboundPart): Promise<void>;
  insertNotice(row: Notice): Promise<void>;
  listNotices(): Promise<Notice[]>;
  markNoticeRead(id: string, readAt: string): Promise<void>;
  insertAudit(row: Audit): Promise<void>;
  listAudits(conversationId?: string): Promise<Audit[]>;
  insertFile(row: StoredFile): Promise<void>;
  listFiles(): Promise<StoredFile[]>;
  insertApproval(row: Approval): Promise<void>;
  listApprovals(conversationId: string): Promise<Approval[]>;
  invalidateApprovals(conversationId: string): Promise<void>;
  insertNote(row: ModuleNote): Promise<void>;
  listNotes(): Promise<ModuleNote[]>;
  findWalletByPhone(phone: string): Promise<WalletClient | null>;
  listWallet(): Promise<WalletClient[]>;
  insertWallet(row: WalletClient): Promise<void>;
  updateWallet(row: WalletClient): Promise<void>;
  clearSimulation(): Promise<void>;
}
