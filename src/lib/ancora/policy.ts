import { canonicalPhone, isSelfPhone } from "./phones.ts";
import { isInsideWindow, nextDaytimeIso } from "./time.ts";
import type { Conversation, IngressEvent, Lane, Entry } from "./types.ts";

const COMMERCIAL =
  /plano de sa[uú]de|conv[eê]nio|s[eê]nior|\bsenior\b|cota[cç][aã]o|ades[aã]o|best\s*sa[uú]de/i;
const PERSONAL =
  /te amo|saudade|jantar|almo[cç]o em casa|buscar (?:a|o) (?:filha|filho|sobrinha)|conta de luz|festa de anivers[aá]rio|nosso filho/i;
const GREETING =
  /^(?:oi|ol[aá]|oie|hey|bom dia|boa tarde|boa noite|tudo bem|e a[ií])[\s!.?]*$/i;
const FACT_QUESTION =
  /car[eê]ncia|pre[cç]o|valor|rede|coparticipa|cobre|hospital|reembolso|quando|qual\b|quanto/i;
const INJECTION =
  /ignore (?:all |previous |as )?instructions|system prompt|set admin|DATABASE_URL|voc[eê] agora [eé]|token\s*=/i;

const CITIES: { re: RegExp; name: string }[] = [
  { re: /palmas/i, name: "Palmas" },
  { re: /aragua[ií]na/i, name: "Araguaína" },
  { re: /gurupi/i, name: "Gurupi" },
  { re: /porto nacional/i, name: "Porto Nacional" },
  { re: /para[ií]so/i, name: "Paraíso" },
  { re: /colinas/i, name: "Colinas" },
];

export type Existing = Pick<
  Conversation,
  | "lane"
  | "entry"
  | "city"
  | "ages"
  | "displayName"
  | "product"
  | "automation"
  | "customerHasSpoken"
  | "quoteStatus"
  | "hasConfirmedMaterials"
  | "originConfirmed"
  | "campaignRef"
  | "interestNotified"
  | "knownQuoteId"
> | null;

export type Decision = {
  lane: Lane;
  entry: Entry;
  product: string | null;
  city: string | null;
  ages: number[];
  displayName: string | null;
  namePending: boolean;
  originConfirmed: boolean;
  campaignRef: string | null;
  profession: string | null;
  notifyInterest: boolean;
  notifyQuestion: boolean;
  notifyDifficulty: boolean;
  suspendManual: boolean;
  ignoreAsEcho: boolean;
  phoneMismatch: boolean;
  attend: boolean;
  customerHasSpoken: boolean;
  replyIntent:
    | "none"
    | "neutral_greeting"
    | "ask_missing"
    | "quote_pending"
    | "personal_hold"
    | "filo_window"
    | "filo_refused"
    | "paused"
    | "manual_hold";
  missing: string[];
  nextAction: string;
  stage: string;
  pendingReason: string | null;
  requestQuote: boolean;
  reuseQuote: boolean;
  personalApprovalRequired: boolean;
  permissionIgnored: boolean;
  recipientPhone: string | null;
  knownQuoteId: string | null;
  scheduleReviewAt: string | null;
  responsible: string;
};

function uniqueAges(values: number[]): number[] {
  return [...new Set(values.filter((n) => n >= 0 && n <= 120))].sort((a, b) => a - b);
}

export function extractAges(body: string): number[] {
  const found: number[] = [];
  for (const match of body.matchAll(/\b(\d{1,3})\s*anos\b/gi)) {
    found.push(Number(match[1]));
  }
  if (/idad|anos|espos|m[aã]e|pai|filho|ela|ele/i.test(body)) {
    for (const match of body.matchAll(/\b(\d{1,3})\b/g)) {
      const value = Number(match[1]);
      if (value >= 1 && value <= 120) found.push(value);
    }
  }
  return uniqueAges(found);
}

export function extractCity(body: string): string | null {
  for (const city of CITIES) {
    if (city.re.test(body)) return city.name;
  }
  return null;
}

export function extractName(body: string): string | null {
  const match = body.match(
    /(?:meu nome é|me chamo|pode me chamar de)\s+([A-Za-zÀ-ú]+(?:\s+[A-Za-zÀ-ú]+){0,3})/i,
  );
  if (!match) return null;
  return match[1].replace(/[!.?]+$/, "").trim();
}

export function extractProfession(body: string): string | null {
  if (/aposentad/i.test(body)) return "aposentado";
  if (/servidor/i.test(body)) return "servidor";
  if (/aut[oô]nom/i.test(body)) return "autônomo";
  if (/empres[aá]ri/i.test(body)) return "empresário";
  return null;
}

export function isLuis(value: string | null | undefined): boolean {
  if (!value) return false;
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase() === "luis";
}

function blankConversation(): NonNullable<Existing> {
  return {
    lane: "unclassified",
    entry: "unknown",
    city: null,
    ages: [],
    displayName: null,
    product: null,
    automation: "auto",
    customerHasSpoken: false,
    quoteStatus: null,
    hasConfirmedMaterials: false,
    originConfirmed: false,
    campaignRef: null,
    interestNotified: false,
    knownQuoteId: null,
  };
}

export function decide(
  event: IngressEvent,
  existing: Existing,
  opts: { now: Date; windowStart: string; windowEnd: string; globalPause: boolean; isEcho: boolean },
): Decision {
  const prior: NonNullable<Existing> = existing ?? blankConversation();
  const body = (event.body || "").trim();
  const permissionIgnored = INJECTION.test(body);
  const fromMe = Boolean(event.fromMe) && !event.internalChannel;
  const phoneMismatch = Boolean(event.connectedPhone) && !isSelfPhone(event.connectedPhone || "");

  const base: Decision = {
    lane: prior.lane,
    entry: prior.entry,
    product: prior.product,
    city: prior.city,
    ages: prior.ages,
    displayName: prior.displayName,
    namePending: !prior.displayName,
    originConfirmed: prior.originConfirmed,
    campaignRef: prior.campaignRef,
    profession: null,
    notifyInterest: false,
    notifyQuestion: false,
    notifyDifficulty: false,
    suspendManual: false,
    ignoreAsEcho: opts.isEcho,
    phoneMismatch,
    attend: false,
    customerHasSpoken: prior.customerHasSpoken,
    replyIntent: "none",
    missing: [],
    nextAction: prior.lane === "unclassified" ? "classificar" : "acompanhar",
    stage: "received",
    pendingReason: null,
    requestQuote: false,
    reuseQuote: false,
    personalApprovalRequired: false,
    permissionIgnored,
    recipientPhone: null,
    knownQuoteId: prior.knownQuoteId,
    scheduleReviewAt: null,
    responsible: "Luís",
  };

  if (opts.isEcho) {
    base.stage = "echo";
    base.nextAction = "ignorar eco do próprio aplicativo";
    return base;
  }
  if (phoneMismatch) {
    base.attend = false;
    base.notifyDifficulty = true;
    base.stage = "phone_mismatch";
    base.pendingReason = "telefone conectado não é 63992731001";
    base.nextAction = "não gravar atendimento desta instância";
    return base;
  }
  if (fromMe) {
    base.suspendManual = true;
    base.replyIntent = "manual_hold";
    base.stage = "paused_manual";
    base.nextAction = "automação suspensa até retomada no painel";
    base.pendingReason = "intervenção manual de Luís";
    return base;
  }

  if (event.isGroup) {
    base.lane = "unclassified";
    base.attend = false;
    base.notifyDifficulty = true;
    base.stage = "group_held";
    base.pendingReason = "mensagem de grupo não entra no vendedor";
    base.nextAction = "Luís decide se responde; o aplicativo não fala no grupo";
    base.replyIntent = "none";
    return base;
  }

  if (event.internalChannel === "filo") {
    const client = canonicalPhone(event.filoClientPhone || "");
    base.lane = "internal";
    base.entry = "filo";
    base.recipientPhone = client || null;
    base.displayName = event.filoClientName?.trim() || prior.displayName;
    base.namePending = !base.displayName;
    base.knownQuoteId = event.knownQuoteId || prior.knownQuoteId;
    base.responsible = event.filoResponsible || "";
    if (!isLuis(event.filoResponsible)) {
      base.attend = false;
      base.replyIntent = "filo_refused";
      base.stage = "filo_not_responsible";
      base.notifyDifficulty = true;
      base.pendingReason = "entrega da Filó com responsável diferente de Luís";
      base.nextAction = "não atender, não usar o telefone da Filó e não duplicar ficha";
      return base;
    }
    base.attend = true;
    base.reuseQuote = Boolean(base.knownQuoteId);
    base.stage = "filo_received";
    const inside = isInsideWindow(opts.now, opts.windowStart, opts.windowEnd);
    if (!prior.customerHasSpoken && !inside) {
      base.replyIntent = "filo_window";
      base.pendingReason = "primeiro contato ativo fora de 8h–18h";
      base.nextAction = "revisar no próximo período diurno, sem disparo agora";
      base.scheduleReviewAt = nextDaytimeIso(opts.now, opts.windowStart);
      return base;
    }
    base.replyIntent = "quote_pending";
    base.nextAction = base.reuseQuote
      ? "aproveitar cotação existente; primeiro contato só ao cliente, não à Filó"
      : "conferir dados já entregues antes de pedir complemento";
    base.stage = "filo_ready";
    return base;
  }

  const commercial = COMMERCIAL.test(body);
  const personal = PERSONAL.test(body);
  const greeting = GREETING.test(body);
  const ages = uniqueAges([...prior.ages, ...extractAges(body)]);
  const city = prior.city || extractCity(body);
  const name = prior.displayName || extractName(body);
  const profession = extractProfession(body);
  const structuredProduct =
    event.campaignProduct === "senior" || event.campaignProduct === "health"
      ? event.campaignProduct
      : null;
  const structuredCity = event.campaignCity ? extractCity(event.campaignCity) || null : null;
  const reliableCampaign = Boolean(event.referralSourceId) && structuredProduct === "senior";

  base.ages = ages;
  base.city = city || (reliableCampaign ? structuredCity : null);
  base.displayName = name;
  base.namePending = !name;
  base.profession = profession;
  base.customerHasSpoken = true;
  base.recipientPhone = canonicalPhone(event.fromPhone);

  if (permissionIgnored && !commercial && !personal) {
    base.lane = "unclassified";
    base.attend = false;
    base.notifyDifficulty = true;
    base.stage = "permission_ignored";
    base.pendingReason = "texto do cliente não altera permissão";
    base.nextAction = "manter autorização só no painel autenticado";
    base.replyIntent = "none";
    return base;
  }

  if (prior.lane === "personal" || (personal && !commercial)) {
    base.lane = "personal";
    base.entry = "personal";
    base.attend = false;
    base.personalApprovalRequired = true;
    base.replyIntent = "personal_hold";
    base.stage = "personal_draft";
    base.pendingReason = "mensagem pessoal aguardando aprovação";
    base.nextAction = "não enviar sem aprovação de destinatário, texto e anexos";
    base.requestQuote = false;
    return base;
  }

  if (personal && commercial) {
    base.lane = "unclassified";
    base.attend = false;
    base.notifyDifficulty = true;
    base.stage = "classification_doubt";
    base.pendingReason = "dúvida de classificação";
    base.nextAction = "mostrar a ocorrência a Luís antes de vender ou gravar no CRM";
    base.replyIntent = "none";
    return base;
  }

  if (!commercial && !reliableCampaign && prior.lane !== "commercial") {
    if (greeting || !body) {
      base.lane = "unclassified";
      base.entry = "unknown";
      base.attend = true;
      base.replyIntent = "neutral_greeting";
      base.stage = "clarify";
      base.nextAction = "pergunta neutra, sem assumir plano de saúde";
      return base;
    }
    base.lane = "unclassified";
    base.attend = false;
    base.notifyDifficulty = true;
    base.stage = "classification_doubt";
    base.pendingReason = "assunto não reconhecido";
    base.nextAction = "mostrar a ocorrência a Luís";
    base.replyIntent = "none";
    return base;
  }

  base.lane = "commercial";
  base.attend = true;
  if (reliableCampaign) {
    base.entry = "senior_campaign";
    base.product = "senior";
    base.originConfirmed = true;
    base.campaignRef = event.referralSourceId || prior.campaignRef;
    if (!base.city && structuredCity) base.city = structuredCity;
  } else if (prior.entry === "senior_campaign" || prior.entry === "filo" || prior.entry === "direct") {
    base.entry = prior.entry;
    base.product = prior.product || (/\bs[eê]nior\b|\bsenior\b/i.test(body) ? "senior" : prior.product);
    base.originConfirmed = prior.originConfirmed;
    base.campaignRef = prior.campaignRef;
  } else {
    base.entry = "direct";
    base.product = /\bs[eê]nior\b|\bsenior\b/i.test(body) ? "senior" : "health";
    base.originConfirmed = false;
  }

  const firstInterest = !prior.interestNotified;
  if (firstInterest) base.notifyInterest = true;

  if (opts.globalPause || prior.automation !== "auto") {
    base.replyIntent = "paused";
    base.stage = "paused";
    base.pendingReason = opts.globalPause ? "pausa global" : "automação pausada nesta conversa";
    base.nextAction = "não responder até retomada; ocorrência permanece na fila";
    base.requestQuote = false;
    return base;
  }

  const factual =
    FACT_QUESTION.test(body) &&
    (prior.quoteStatus === "completed" || prior.hasConfirmedMaterials || prior.quoteStatus === "not_connected");
  if (factual && !prior.hasConfirmedMaterials) {
    base.notifyQuestion = true;
    base.replyIntent = "none";
    base.stage = "pending_luis";
    base.pendingReason = "dúvida sem resposta comprovada";
    base.nextAction = "Luís responde com fonte; o modelo não completa o dado ausente";
    base.requestQuote = false;
    return base;
  }
  if (factual && prior.hasConfirmedMaterials) {
    base.notifyQuestion = true;
    base.replyIntent = "none";
    base.stage = "pending_luis";
    base.pendingReason = "dúvida depois do orçamento, sem trecho comprovado para esta pergunta";
    base.nextAction = "voltar ao atendimento e notificar Luís; não encerrar no primeiro envio";
    return base;
  }

  const missing: string[] = [];
  if (!base.city) missing.push("cidade");
  if (base.ages.length === 0) missing.push("idades");
  base.missing = missing;

  if (missing.length > 0) {
    base.replyIntent = "ask_missing";
    base.stage = "collecting";
    base.nextAction = `pedir somente: ${missing.join(", ")}`;
    base.requestQuote = false;
    return base;
  }

  base.requestQuote = true;
  base.replyIntent = "quote_pending";
  base.stage = "quote_requested";
  base.namePending = !base.displayName;
  base.nextAction = base.displayName
    ? "cotação pedida com nome informado; preço só vem da DIANA"
    : "cotação pedida; nome permanece pendente e não bloqueia";
  base.pendingReason = "DIANA ainda não conectada — resultado não é cotação concluída";
  if (!isInsideWindow(opts.now, opts.windowStart, opts.windowEnd)) {
    base.scheduleReviewAt = nextDaytimeIso(opts.now, opts.windowStart);
  }
  return base;
}
