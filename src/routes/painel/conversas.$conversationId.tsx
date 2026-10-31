import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  approveDraft,
  loadConversation,
  releaseAttachment,
  saveConversationDraft,
  setConversationAutomation,
} from "@/lib/ancora/fns";
import { formatPalmas } from "@/lib/ancora/time";
import { phoneLabel } from "@/lib/ancora/phones";

export const Route = createFileRoute("/painel/conversas/$conversationId")({
  component: Conversa,
});

function Conversa() {
  const { conversationId } = Route.useParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadConversation>> | null>(null);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");

  async function refresh() {
    const next = await loadConversation({ data: conversationId });
    setData(next);
    if (!next.forbidden && !next.missing) setDraft(next.conversation.draft);
  }

  useEffect(() => {
    void refresh();
  }, [conversationId]);

  useEffect(() => {
    if (!data || data.forbidden || data.missing) return;
    const timer = window.setTimeout(() => {
      void saveConversationDraft({ data: { id: conversationId, draft } });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draft, conversationId, data]);

  if (!data) return <p className="text-muted">Abrindo conversa…</p>;
  if (data.forbidden) return <p>Acesso reservado.</p>;
  if (data.missing) return <p>Conversa não encontrada.</p>;
  const { conversation, messages, quotes, parts } = data;

  return (
    <div className="space-y-4">
      <header className="rounded-3xl bg-paper px-4 py-4 text-ink">
        <p className="text-xs tracking-[0.16em] uppercase text-teal-deep">Conversa</p>
        <h1 className="mt-1 text-3xl">{conversation.displayName || "Nome pendente"}</h1>
        <p className="text-sm">{phoneLabel(conversation.phone)} · {conversation.stage}</p>
        <p className="mt-2 text-sm">
          {data.wallet
            ? `Na carteira de ${data.wallet.assignedTo}, vinculado à cotação ${data.wallet.quoteId}.`
            : "Ainda fora da carteira. Entra só com cotação válida, salva e vinculada."}
        </p>
        <p className="mt-2 text-sm">{conversation.nextAction}</p>
      </header>
      <div className="space-y-2">
        {messages.map((message) => (
          <article key={message.id} className={message.direction === "outbound" ? "ml-8 rounded-2xl bg-teal-deep px-3 py-2 text-paper" : "mr-8 rounded-2xl bg-ink-2 px-3 py-2"}>
            <p>{message.body}</p>
            <p className="mt-1 text-xs opacity-70">
              {message.author} · {message.status}
              {message.draftSource === "policy_template" ? " · regra, não é o modelo" : ""}
              {" · "}
              {formatPalmas(message.createdAt)}
            </p>
          </article>
        ))}
      </div>
      <label className="block">
        <span className="text-sm text-muted">Resposta em edição. Ela fica gravada se você sair da tela.</span>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="mt-2 min-h-28 w-full rounded-2xl border border-line bg-ink-2 px-3 py-3 text-paper"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 rounded-full bg-teal px-4 font-semibold text-ink"
          onClick={() =>
            setConversationAutomation({
              data: { id: conversation.id, automation: conversation.automation === "auto" ? "paused" : "auto" },
            }).then(refresh)
          }
        >
          {conversation.automation === "auto" ? "Pausar esta conversa" : "Retomar automação"}
        </button>
        <button
          type="button"
          className="min-h-11 rounded-full border border-line px-4"
          onClick={() => approveDraft({ data: { id: conversation.id, body: draft } }).then((result) => setNote(`Estado: ${result.state}`)).then(refresh)}
        >
          Aprovar texto pessoal
        </button>
        <button type="button" className="min-h-11 rounded-full border border-line px-4" onClick={() => releaseAttachment({ data: conversation.id }).then(refresh)}>
          Liberar próximo anexo
        </button>
      </div>
      {note ? <p className="text-sm text-copper">{note}</p> : null}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line px-4 py-3">
          <h2 className="text-xl">Cotação</h2>
          {quotes.length === 0 ? <p className="text-sm text-muted">Nenhum pedido.</p> : null}
          {quotes.map((quote) => (
            <p key={quote.id} className="mt-2 text-sm text-muted">
              {quote.status} · {quote.simulated ? "simulado" : "real"} · {quote.detail}
            </p>
          ))}
        </div>
        <div className="rounded-2xl border border-line px-4 py-3">
          <h2 className="text-xl">Saídas</h2>
          {parts.length === 0 ? <p className="text-sm text-muted">Nenhuma saída preparada.</p> : null}
          {parts.map((part) => (
            <p key={part.id} className="mt-2 text-sm text-muted">
              {part.position}. {part.kind} · {part.state} · {phoneLabel(part.recipientPhone)}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
