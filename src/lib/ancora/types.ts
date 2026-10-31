export type Source = "simulation" | "zapi" | "panel";

export type Lane = "commercial" | "personal" | "unclassified" | "internal";

export type Entry = "senior_campaign" | "direct" | "filo" | "personal" | "unknown";

export type Automation = "auto" | "suspended_manual" | "paused";

export type Settings = {
  globalPause: boolean;
  retentionDays: number;
  personalDriveDays: number;
  windowStart: string;
  windowEnd: string;
  modelCallsDate: string;
  modelCalls: number;
};

export type ProviderState = {
  connection: "not_connected" | "unknown" | "connected" | "interrupted";
  lastWebhookAt: string | null;
  lastReceivedAt: string | null;
  lastProcessedAt: string | null;
  gapNote: string;
};

export type Conversation = {
  id: string;
  phone: string;
  source: Source;
  displayName: string | null;
  namePending: boolean;
  lane: Lane;
  entry: Entry;
  product: string | null;
  city: string | null;
  ages: number[];
  profession: string | null;
  campaignRef: string | null;
  originConfirmed: boolean;
  stage: string;
  automation: Automation;
  responsible: string;
  customerHasSpoken: boolean;
  interestNotified: boolean;
  draft: string;
  pendingReason: string | null;
  nextAction: string;
  lastInboundAt: string | null;
  lastProcessedAt: string | null;
  quoteStatus: string | null;
  hasConfirmedMaterials: boolean;
  knownQuoteId: string | null;
  scenario: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  providerMessageId: string;
  direction: "inbound" | "outbound" | "internal";
  author: "customer" | "luis_manual" | "app" | "filo" | "system";
  body: string;
  payload: string;
  source: Source;
  status: string;
  draftSource: "policy_template" | "model" | "none";
  isEcho: boolean;
  fromMe: boolean;
  scenario: string | null;
  createdAt: string;
};

export type Job = {
  id: string;
  conversationId: string | null;
  messageId: string | null;
  kind: string;
  status: "pending" | "running" | "done" | "failed";
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  lockedAt: string | null;
  lastError: string | null;
  scenario: string | null;
  createdAt: string;
};

export type Quote = {
  id: string;
  conversationId: string;
  requestKey: string;
  status: string;
  solicitationId: string | null;
  quoteId: string | null;
  clientId: string | null;
  savedConfirmed: boolean;
  simulated: boolean;
  missing: string[];
  detail: string;
  createdAt: string;
};

export type OutboundPart = {
  id: string;
  conversationId: string;
  quoteId: string | null;
  position: number;
  kind: string;
  recipientPhone: string;
  body: string;
  attachmentRef: string | null;
  state: string;
  approvalHash: string | null;
  scenario: string | null;
  createdAt: string;
};

export type Notice = {
  id: string;
  conversationId: string | null;
  kind: "interest" | "question" | "difficulty";
  title: string;
  body: string;
  readAt: string | null;
  scenario: string | null;
  createdAt: string;
};

export type Audit = {
  id: string;
  conversationId: string | null;
  kind: string;
  detail: string;
  scenario: string | null;
  createdAt: string;
};

export type StoredFile = {
  id: string;
  conversationId: string | null;
  scope: "client" | "manual" | "personal";
  kind: string;
  version: number;
  storageRef: string;
  name: string;
  simulated: boolean;
  createdAt: string;
};

export type Approval = {
  id: string;
  conversationId: string;
  recipientPhone: string;
  bodyHash: string;
  attachmentHash: string;
  status: "pending" | "approved" | "invalidated";
  createdAt: string;
};

/** Cliente deste WhatsApp na carteira local. Não é a carteira da DIANA. */
export type WalletClient = {
  id: string;
  phone: string;
  displayName: string | null;
  assignedTo: string;
  conversationId: string;
  quoteRowId: string;
  quoteId: string;
  clientId: string | null;
  simulated: boolean;
  linkedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ModuleNote = {
  id: string;
  module: "sales" | "personal" | "diana";
  role: "luis" | "module";
  body: string;
  createdAt: string;
};

export type IngressEvent = {
  providerMessageId: string;
  connectedPhone?: string | null;
  fromPhone: string;
  fromMe?: boolean;
  body: string;
  pushName?: string | null;
  referralSourceId?: string | null;
  campaignProduct?: string | null;
  campaignCity?: string | null;
  internalChannel?: "filo" | null;
  filoResponsible?: string | null;
  filoClientPhone?: string | null;
  filoClientName?: string | null;
  knownQuoteId?: string | null;
  knownClientId?: string | null;
  isGroup?: boolean;
};

export type Runtime = {
  now: Date;
  source: Source;
  sendsEnabled: boolean;
  dianaEnabled: boolean;
  selfPhone: string;
  scenario: string | null;
  deliver?: (input: {
    phone: string;
    body: string;
    attachmentRef: string | null;
  }) => Promise<"accepted" | "failed" | "uncertain" | "blocked_send_disabled">;
};

export const GAP_NOTE =
  "Histórico anterior à ativação não foi recuperado. Ausência de mensagens no banco não comprova ausência de perguntas no WhatsApp.";

export function defaultSettings(): Settings {
  return {
    globalPause: false,
    retentionDays: 365,
    personalDriveDays: 5,
    windowStart: "08:00",
    windowEnd: "18:00",
    modelCallsDate: "",
    modelCalls: 0,
  };
}

export function defaultProvider(): ProviderState {
  return {
    connection: "not_connected",
    lastWebhookAt: null,
    lastReceivedAt: null,
    lastProcessedAt: null,
    gapNote: GAP_NOTE,
  };
}
