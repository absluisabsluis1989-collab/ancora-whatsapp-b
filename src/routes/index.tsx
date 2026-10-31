import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({ component: Home });

type Health = {
  database?: string;
  stage?: string;
  applicationImplemented?: boolean;
  sendsEnabled?: boolean;
  modelConfigured?: boolean;
  dianaEnabled?: boolean;
  webhookConfigured?: boolean;
};

function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then(setHealth)
      .catch(() => setHealth({ database: "CHECK_FAILED" }));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-10">
      <p className="text-xs font-medium tracking-[0.22em] text-teal uppercase">Ambiente B · Palmas</p>
      <h1 className="mt-3 text-5xl leading-none text-paper">WhatsApp de Luís</h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
        Vendedor de planos Best e assistente pessoal no número 63 99273-1001. O painel, a fila e o banco
        já existem. WhatsApp, DIANA e o modelo ainda não estão ligados.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Status label="Aplicação" value="Implementada" ok />
        <Status
          label="Banco"
          value={health?.database === "CONNECTED" ? "Conectado" : health ? "Falha no teste" : "Conferindo"}
          ok={health?.database === "CONNECTED"}
        />
        <Status label="Envios" value={health?.sendsEnabled ? "Ligados" : "Desligados"} ok={!health?.sendsEnabled} />
        <Status label="Modelo" value={health?.modelConfigured ? "Configurado" : "Pendente"} ok={false} />
        <Status label="WhatsApp real" value={health?.webhookConfigured ? "Segredo presente" : "Não conectado"} ok={false} />
        <Status label="DIANA real" value={health?.dianaEnabled ? "Habilitada" : "Não validada"} ok={false} />
      </div>
      <ol className="mt-8 space-y-3 text-sm text-paper">
        {[
          "Entrada validada e gravada antes do recibo",
          "Fila durável no próprio Postgres",
          "Regra decide; o modelo só redige quando houver chave",
          "DIANA calcula. Este aplicativo não inventa preço",
          "Saída só com pausa revalidada e envio habilitado",
        ].map((step, index) => (
          <li key={step} className="flex gap-3 rounded-2xl border border-line bg-ink-2 px-4 py-3">
            <span className="text-teal">0{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          to="/painel"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-teal px-5 font-semibold text-ink"
        >
          Abrir o painel
        </Link>
        <Link
          to="/login"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-paper"
        >
          Entrar
        </Link>
      </div>
      <p className="mt-8 text-sm leading-relaxed text-muted">
        Testes do laboratório são simulação. Uma resposta pronta por regra não comprova a IA. A carteira da DIANA
        não é alterada. Cliente deste WhatsApp só entra na carteira local, atribuído a Luís, depois de cotação válida
        salva e vinculada, sem duplicar o telefone.
      </p>
    </main>
  );
}

function Status({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-4 py-3">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className={ok ? "mt-1 text-ok" : "mt-1 text-copper"}>{value}</p>
    </div>
  );
}
