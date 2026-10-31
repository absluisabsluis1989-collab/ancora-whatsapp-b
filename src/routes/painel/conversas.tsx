import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadBoard } from "@/lib/ancora/fns";
import { phoneLabel } from "@/lib/ancora/phones";

export const Route = createFileRoute("/painel/conversas")({ component: Conversas });

function Conversas() {
  const [board, setBoard] = useState<Awaited<ReturnType<typeof loadBoard>> | null>(null);
  useEffect(() => {
    loadBoard().then(setBoard).catch(() => setBoard(null));
  }, []);
  if (!board) return <p className="text-muted">Carregando conversas…</p>;
  if (board.forbidden) return <p>Acesso reservado.</p>;
  const waiting = board.conversations.filter((item) => item.pendingReason || item.stage === "collecting");
  const quiet = board.conversations.filter((item) => !waiting.includes(item));
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs tracking-[0.18em] text-teal uppercase">Carteira local</p>
        <h1 className="mt-2 text-4xl text-paper">Conversas</h1>
        <p className="mt-2 text-sm text-muted">Isto não é a carteira da DIANA. Nenhum cliente real foi importado.</p>
      </header>
      <Group title="Aguardando ação" items={waiting} />
      <Group title="Sem atualização pendente" items={quiet} />
    </div>
  );
}

function Group({
  title,
  items,
}: {
  title: string;
  items: { id: string; phone: string; displayName: string | null; lane: string; stage: string; nextAction: string }[];
}) {
  return (
    <section>
      <h2 className="text-2xl text-paper">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? <p className="text-sm text-muted">Nada aqui.</p> : null}
        {items.map((item) => (
          <Link key={item.id} to="/painel/conversas/$conversationId" params={{ conversationId: item.id }} className="block rounded-2xl border border-line bg-panel px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-paper">{item.displayName || "Nome pendente"}</p>
              <p className="text-xs text-muted">{item.lane}</p>
            </div>
            <p className="text-sm text-muted">{phoneLabel(item.phone)}</p>
            <p className="text-sm text-teal">{item.nextAction}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
