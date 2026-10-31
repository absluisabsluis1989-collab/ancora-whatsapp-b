export const DIANA_CONTRACT = {
  name: "ancora.whatsapp.diana.v1",
  auth: "Authorization: Bearer <DIANA_INTEGRATION_TOKEN>. Não usa a senha pessoal de Luís.",
  request: {
    action: "quote.request",
    requestKey: "quote:{conversationId}:{product}:{city}:{ages}",
    phone: "5563… telefone validado do cliente",
    entry: "senior_campaign | direct | filo",
    campaignRef: "referência do anúncio ou null",
    productHint: "senior | health",
    city: "string | null",
    ages: [67],
    profession: "string | null",
    displayName: "string | null",
    namePending: true,
    knownClientId: "string | null",
    responsibleExpected: "Luís",
  },
  responseStatuses: ["completed", "missing_data", "commercial_block", "technical_failure", "uncertain"],
  completedFields: ["solicitationId", "quoteId", "clientId", "saved", "materials"],
  events: ["quote.provider_accepted", "quote.delivered", "quote.read"],
  rules: [
    "O aplicativo não grava SQL na DIANA e não calcula preço.",
    "Cliente novo deste WhatsApp entra na carteira local, atribuído a Luís, só depois de cotação válida salva e vinculada (status completed, saved e quoteId). O mesmo telefone não gera segunda ficha.",
    "Pedidos concorrentes repetem a mesma requestKey e não criam outra ficha.",
    "Aceite do provedor, entrega e leitura são eventos diferentes.",
    "Texto apresentado ou arquivo enviado só à corretora não comprova envio ao cliente.",
    "Sênior não recebe coparticipação e a rede é a de Palmas, quando a DIANA confirmar.",
  ],
} as const;

export const MODEL_CHOICE = {
  product: "Claude Sonnet 4.6",
  provider: "Anthropic",
  modelId: "claude-sonnet-4-6",
  contextTokens: "1.000.000 (anúncio Anthropic de 13/03/2026: janela de 1M sem ágio de contexto longo; catálogos conferidos em 30/10/2026)",
  maxOutput: "As fontes secundárias divergem entre 64 mil e 128 mil tokens. O aplicativo limita a própria chamada a 500 tokens de saída. Confirmar o teto do provedor ao instalar a chave.",
  price: "US$ 3 por 1M de tokens de entrada e US$ 15 por 1M de saída, preço padrão divulgado pela Anthropic para o Sonnet 4.6. Leitura de cache aparece como US$ 0,30 / 1M em catálogos de 30/10/2026.",
  latency: "Não medida neste ambiente. Não há um número único de latência publicado para usar aqui.",
  estimate:
    "Conta hipotética, não medição: até 6.000 tokens de entrada selecionada e 500 de saída dão cerca de US$ 0,026 por chamada (6.000/1e6×3 + 500/1e6×15). Seis chamadas dariam cerca de US$ 0,15 por atendimento. Vários passos não chamam modelo.",
  why: "O preço, a rede e a carência vêm da DIANA, não da memória do modelo. O modelo só redige, em português, a intenção que a regra já decidiu. Sonnet 4.6 cobre ferramenta, contexto e instrução sem o custo do Opus 4.6 (US$ 5 / US$ 25 por 1M). Um segundo modelo não é usado, para não partir o contexto nem a autorização.",
  status: "NOT_CONFIGURED",
} as const;
