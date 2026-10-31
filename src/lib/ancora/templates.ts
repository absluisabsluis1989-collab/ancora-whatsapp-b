import type { Decision } from "./policy.ts";

/** Fixed wording used only while the model is not configured. This is not an AI reply. */
export function policyTemplate(decision: Decision): string | null {
  switch (decision.replyIntent) {
    case "neutral_greeting":
      return "Oi, aqui é o Luís. Em que posso ajudar?";
    case "ask_missing":
      if (decision.product === "senior" && decision.city && decision.missing.includes("idades")) {
        return `Anotei o interesse no Sênior em ${decision.city}. Quais as idades de quem entra no plano?`;
      }
      return `Para eu seguir, preciso só de ${decision.missing.join(" e ")}.`;
    case "quote_pending":
      if (decision.entry === "filo") {
        return decision.reuseQuote
          ? "Recebi seu contato por aqui. Já tenho a cotação anterior e sigo com ela, sem refazer tudo."
          : "Recebi seu contato. Vou conferir o que já está pronto antes de te pedir qualquer dado.";
      }
      if (decision.namePending) {
        return "Anotei cidade e idades. Peço a cotação no sistema; o nome pode ficar para depois, sem travar a simulação. Não tenho preço para te passar antes disso.";
      }
      return "Dados anotados. Peço a cotação no sistema e te retorno com o material certo. Não invento valor nem rede.";
    case "personal_hold":
      return null;
    case "filo_window":
    case "filo_refused":
    case "paused":
    case "manual_hold":
    case "none":
      return null;
    default:
      return null;
  }
}
