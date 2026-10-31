import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadBoard } from "@/lib/ancora/fns";
import { formatPalmas } from "@/lib/ancora/time";

export const Route = createFileRoute("/painel/fila")({ component: Fila });

function Fila() {
  const [board, setBoard] = useState<Awaited<ReturnType<typeof loadBoard>> | null>(null);
  useEffect(() => {
    loadBoard().then(setBoard).catch(() => setBoard(null));
  }, []);
  if (!board) return <p className="text-muted">Lendo a fila…</p>;
  if (board.forbidden) return <p>Acesso reservado.</p>;
  return (
    <div>
      <p className="text-xs tracking-[0.18em] text-teal uppercase">Postgres</p>
      <h1 className="mt-2 text-4xl text-paper">Fila</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Cada entrada gravada ganha uma tarefa. O trabalho de uma conversa é serial; clientes diferentes
        seguem em paralelo. Fechar esta página não apaga a fila. Sem o segredo do tick, a retomada de uma
        tarefa órfã espera o próximo evento ou esta abertura autenticada.
      </p>
      <div className="mt-5 space-y-2">
        {board.jobs.length === 0 ? <p className="text-muted">Nenhuma tarefa.</p> : null}
        {board.jobs.map((job) => (
          <article key={job.id} className="rounded-2xl border border-line bg-panel px-4 py-3">
            <p className="text-paper">{job.kind}</p>
            <p className="text-sm text-muted">
              {job.status} · tentativa {job.attempts}/{job.maxAttempts} · {formatPalmas(job.createdAt)}
            </p>
            {job.lastError ? <p className="text-sm text-danger">{job.lastError}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
