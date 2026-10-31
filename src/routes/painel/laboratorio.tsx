import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { askModule, clearLab, runLabScenario, scenarioCatalog } from "@/lib/ancora/fns";
import type { ScenarioReport } from "@/lib/ancora/scenarios";

export const Route = createFileRoute("/painel/laboratorio")({ component: Laboratorio });

function Laboratorio() {
  const [catalog, setCatalog] = useState<{ id: string; title: string }[]>([]);
  const [reports, setReports] = useState<ScenarioReport[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [moduleName, setModuleName] = useState<"sales" | "personal" | "diana">("sales");
  const [text, setText] = useState("O que você pode prometer ao cliente?");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    scenarioCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs tracking-[0.18em] text-copper uppercase">Simulação</p>
        <h1 className="mt-2 text-4xl text-paper">Laboratório</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Estes casos passam pela mesma fila e pelas mesmas regras. Não chamam Z-API, DIANA nem o modelo.
          Não provam a IA. Não usam a carteira real.
        </p>
      </header>
      <button type="button" className="min-h-11 rounded-full border border-line px-4" onClick={() => clearLab().then(() => setReports([]))}>
        Limpar simulações
      </button>
      <div className="space-y-3">
        {catalog.map((item) => {
          const report = reports.find((entry) => entry.id === item.id);
          return (
            <article key={item.id} className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl text-paper">{item.title}</h2>
                <button
                  type="button"
                  disabled={running === item.id}
                  className="min-h-11 rounded-full bg-teal px-4 font-semibold text-ink disabled:opacity-60"
                  onClick={() => {
                    setRunning(item.id);
                    runLabScenario({ data: item.id })
                      .then((result) => {
                        if (!result.forbidden) {
                          setReports((current) => [result.report, ...current.filter((entry) => entry.id !== item.id)]);
                        }
                      })
                      .finally(() => setRunning(null));
                  }}
                >
                  {running === item.id ? "Rodando" : "Rodar"}
                </button>
              </div>
              {report ? (
                <ul className="mt-3 space-y-1 text-sm">
                  {report.checks.map((check) => (
                    <li key={check.name} className={check.pass ? "text-ok" : "text-danger"}>
                      {check.pass ? "Passou" : "Falhou"} · {check.name} — {check.detail}
                    </li>
                  ))}
                  <li className="text-muted">IA real: pendente. WhatsApp real: pendente. DIANA real: pendente.</li>
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
      <section className="rounded-3xl border border-line px-4 py-4">
        <h2 className="text-2xl text-paper">Falar com um módulo</h2>
        <p className="mt-1 text-sm text-muted">Conversa interna. Não envia WhatsApp e não é o modelo.</p>
        <div className="mt-3 flex gap-2">
          {(["sales", "personal", "diana"] as const).map((item) => (
            <button key={item} type="button" className={moduleName === item ? "min-h-11 rounded-full bg-paper px-3 text-ink" : "min-h-11 rounded-full border border-line px-3"} onClick={() => setModuleName(item)}>
              {item === "sales" ? "Vendas" : item === "personal" ? "Pessoal" : "DIANA"}
            </button>
          ))}
        </div>
        <textarea value={text} onChange={(event) => setText(event.target.value)} className="mt-3 min-h-24 w-full rounded-2xl border border-line bg-ink-2 px-3 py-3" />
        <button
          type="button"
          className="mt-3 min-h-11 rounded-full bg-teal px-4 font-semibold text-ink"
          onClick={() => askModule({ data: { module: moduleName, text } }).then((result) => setAnswer(result.answer))}
        >
          Perguntar
        </button>
        {answer ? <p className="mt-3 text-sm leading-relaxed text-paper">{answer}</p> : null}
      </section>
    </div>
  );
}
