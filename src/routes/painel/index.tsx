import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadBoard, markNoticesRead, setWorkspacePause } from "@/lib/ancora/fns";
import { formatPalmas } from "@/lib/ancora/time";
import { phoneLabel } from "@/lib/ancora/phones";

export const Route = createFileRoute("/painel/")({ component: Operacao });

function Operacao() {
  const [board, setBoard] = useState<Awaited<ReturnType<typeof loadBoard>> | null>(null);
  const [sound, setSound] = useState(false);

  async function refresh() {
    setBoard(await loadBoard());
  }

  useEffect(() => {
    setSound(localStorage.getItem("ancora-sound") === "1");
    void refresh();
  }, []);

  if (!board) return <p className="text-muted">Abrindo a operação…</p>;
  if (board.forbidden) return <p>Este acesso não é o dono do ambiente.</p>;

  const waiting = board.conversations.filter((item) => item.pendingReason);
  const quiet = board.conversations.filter((item) => !item.pendingReason);
  const pendingJobs = board.jobs.filter((job) => job.status === "pending" || job.status === "running");

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs tracking-[0.18em] text-teal uppercase">Operação</p>
        <h1 className="mt-2 text-4xl text-paper">O que precisa de você</h1>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        <Tile label="Provedor" value={board.provider.connection === "connected" ? "Sessão vista" : "Não conectado"} />
        <Tile label="Última recebida" value={formatPalmas(board.provider.lastReceivedAt)} />
        <Tile label="Última processada" value={formatPalmas(board.provider.lastProcessedAt)} />
      </section>
      <p className="rounded-2xl border border-line bg-ink-2 px-4 py-3 text-sm leading-relaxed text-muted">
        {board.provider.gapNote} Envios {board.flags.sendsEnabled ? "ligados" : "desligados"}. Modelo{" "}
        {board.flags.modelConfigured ? "configurado" : "não configurado"}.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 rounded-full bg-teal px-4 font-semibold text-ink"
          onClick={() => setWorkspacePause({ data: !board.settings.globalPause }).then(refresh)}
        >
          {board.settings.globalPause ? "Retomar tudo" : "Pausar tudo"}
        </button>
        <button
          type="button"
          className="min-h-11 rounded-full border border-line px-4"
          onClick={() => {
            const next = !sound;
            localStorage.setItem("ancora-sound", next ? "1" : "0");
            setSound(next);
          }}
        >
          Som {sound ? "ligado" : "desligado"}
        </button>
        <button
          type="button"
          className="min-h-11 rounded-full border border-line px-4"
          onClick={() => Notification.requestPermission()}
        >
          Aviso do navegador
        </button>
        <button type="button" className="min-h-11 rounded-full border border-line px-4" onClick={() => markNoticesRead().then(refresh)}>
          Marcar avisos como vistos
        </button>
      </div>
      <section>
        <h2 className="text-2xl text-paper">Pendências</h2>
        <div className="mt-3 space-y-2">
          {waiting.length === 0 ? <p className="text-muted">Nenhuma conversa pendente.</p> : null}
          {waiting.map((item) => (
            <Link key={item.id} to="/painel/conversas/$conversationId" params={{ conversationId: item.id }} className="block rounded-2xl border border-line bg-panel px-4 py-3">
              <p className="text-paper">{item.displayName || phoneLabel(item.phone)}</p>
              <p className="text-sm text-copper">{item.pendingReason}</p>
              <p className="text-sm text-muted">{item.nextAction}</p>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-2xl text-paper">Avisos</h2>
        <div className="mt-3 space-y-2">
          {board.notices.length === 0 ? <p className="text-muted">A fila de avisos está vazia. Ela permanece mesmo se o aviso do navegador falhar.</p> : null}
          {board.notices.slice(0, 8).map((notice) => (
            <article key={notice.id} className="rounded-2xl border border-line px-4 py-3">
              <p className="text-paper">{notice.title}</p>
              <p className="text-sm text-muted">{notice.body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        <Tile label="Fila aberta" value={String(pendingJobs.length)} />
        <Tile label="Carteira deste WhatsApp" value={String(board.wallet.length)} />
      </section>
      <section>
        <h2 className="text-2xl text-paper">Carteira</h2>
        <p className="mt-2 text-sm text-muted">
          Cliente novo entra aqui, atribuído a Luís, só depois de cotação válida salva e vinculada. O mesmo telefone não gera outra ficha. O laboratório não aparece nesta lista. A DIANA não foi alterada.
        </p>
        <div className="mt-3 space-y-2">
          {board.wallet.length === 0 ? <p className="text-muted">Nenhum cliente operacional ainda.</p> : null}
          {board.wallet.map((client) => (
            <Link
              key={client.id}
              to="/painel/conversas/$conversationId"
              params={{ conversationId: client.conversationId }}
              className="block rounded-2xl border border-line bg-panel px-4 py-3"
            >
              <p className="text-paper">{client.displayName || phoneLabel(client.phone)}</p>
              <p className="text-sm text-muted">
                {phoneLabel(client.phone)} · {client.assignedTo} · cotação {client.quoteId}
              </p>
            </Link>
          ))}
        </div>
      </section>
      <p className="text-sm text-muted">Conversas sem pendência: {quiet.length}.</p>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-4 py-3">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 text-paper">{value}</p>
    </div>
  );
}
