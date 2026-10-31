import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DIANA_CONTRACT, MODEL_CHOICE } from "@/lib/ancora/contract";
import { runRetention, updateRetention } from "@/lib/ancora/fns";

export const Route = createFileRoute("/painel/contrato")({ component: Contrato });

function Contrato() {
  const [days, setDays] = useState(365);
  const [note, setNote] = useState("");
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs tracking-[0.18em] text-teal uppercase">Entrega</p>
        <h1 className="mt-2 text-4xl text-paper">Contrato e limites</h1>
      </header>
      <section className="space-y-2 text-sm leading-relaxed text-muted">
        <h2 className="text-2xl text-paper">O que está feito</h2>
        <p>Aplicação, banco próprio, fila, painel, autenticação e adaptadores. Testes do laboratório são simulados.</p>
        <p>IA real, WhatsApp real e DIANA real continuam pendentes. Nenhuma dessas partes foi declarada como validada.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-2xl text-paper">Modelo recomendado</h2>
        <p className="text-paper">{MODEL_CHOICE.product}</p>
        <p className="text-sm text-muted">Provedor {MODEL_CHOICE.provider}. Id {MODEL_CHOICE.modelId}. Estado atual: {MODEL_CHOICE.status}.</p>
        <p className="text-sm leading-relaxed text-muted">{MODEL_CHOICE.why}</p>
        <p className="text-sm leading-relaxed text-muted">Contexto: {MODEL_CHOICE.contextTokens}</p>
        <p className="text-sm leading-relaxed text-muted">Preço divulgado: {MODEL_CHOICE.price}</p>
        <p className="text-sm leading-relaxed text-muted">Saída máxima: {MODEL_CHOICE.maxOutput}</p>
        <p className="text-sm leading-relaxed text-muted">Latência: {MODEL_CHOICE.latency}</p>
        <p className="text-sm leading-relaxed text-muted">{MODEL_CHOICE.estimate}</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-2xl text-paper">DIANA · {DIANA_CONTRACT.name}</h2>
        <p className="text-sm text-muted">{DIANA_CONTRACT.auth}</p>
        <p className="text-sm text-muted">Respostas aceitas: {DIANA_CONTRACT.responseStatuses.join(", ")}.</p>
        {DIANA_CONTRACT.rules.map((rule) => (
          <p key={rule} className="text-sm text-muted">{rule}</p>
        ))}
        <p className="text-sm text-muted">O endpoint /api/integrations/diana responde 423 enquanto DIANA_INTEGRATION_ENABLED não for 1.</p>
      </section>
      <section className="space-y-2 text-sm leading-relaxed text-muted">
        <h2 className="text-2xl text-paper">WhatsApp e Z-API</h2>
        <p>A conexão da Z-API depende de sessão iniciada por QR. O celular pode continuar em uso enquanto o aparelho vinculado seguir ativo. Se a sessão cair, a hospedagem continua no ar e o envio para. O painel mostra a lacuna; ausência de mensagem no banco não significa silêncio no WhatsApp.</p>
        <p>O callback deste aplicativo é /api/webhooks/zapi, com o cabeçalho x-ancora-webhook-token. Sem o segredo, ele recusa e não grava. Envio só ocorre com ZAPI_SEND_ENABLED=1 e credenciais. Aceite do provedor não é entrega nem leitura.</p>
        <p>Número desta instância: 63992731001. Outra instância é recusada. A API oficial do WhatsApp pode substituir o transporte depois; isso não está configurado.</p>
      </section>
      <section className="space-y-2 text-sm leading-relaxed text-muted">
        <h2 className="text-2xl text-paper">Fila e custo</h2>
        <p>A fila mora na tabela jobs do Postgres deste aplicativo. Não há Redis. Cada mensagem recebida já deixa um trabalho gravado antes do processamento. Com o painel fechado, quem continua a fila é o processo <span className="text-paper">npm run fila</span>, que chama /api/queue/tick. No servidor publicado, o mesmo endereço aceita GET com CRON_SECRET, para um agendador externo. Sem QUEUE_TICK_SECRET ou CRON_SECRET o tick recusa e não finge que drenou. Envio continua desligado.</p>
        <p>Vercel e Neon já estão reservados para este ambiente. Os valores das faturas não foram medidos aqui. Z-API segue o contrato que Luís já tem. Drive do assistente pessoal, retenção de cinco dias, ainda não está conectado. A retenção comercial local começa em 365 dias, não nos 48h do assistente antigo, e não apaga CRM nem mensagens do aparelho.</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl text-paper">Retenção comercial</h2>
        <label className="block text-sm text-muted">
          Dias
          <input
            type="number"
            min={7}
            max={3650}
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="mt-2 block min-h-11 w-32 rounded-xl border border-line bg-ink-2 px-3"
          />
        </label>
        <div className="flex gap-2">
          <button type="button" className="min-h-11 rounded-full bg-teal px-4 font-semibold text-ink" onClick={() => updateRetention({ data: days }).then(() => setNote("Prazo gravado."))}>
            Guardar prazo
          </button>
          <button type="button" className="min-h-11 rounded-full border border-line px-4" onClick={() => runRetention().then((result) => setNote(`${result.archived} corpos arquivados localmente.`))}>
            Aplicar retenção local
          </button>
        </div>
        {note ? <p className="text-sm text-copper">{note}</p> : null}
      </section>
      <section className="space-y-2 text-sm leading-relaxed text-muted">
        <h2 className="text-2xl text-paper">Variáveis, sem valores</h2>
        <p>APP_WORKSPACE, APP_STAGE, WHATSAPP_SELF_PHONE, ZAPI_SEND_ENABLED, DIANA_INTEGRATION_ENABLED, MODEL_STATUS, MODEL_API_KEY, MODEL_NAME, ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN, ZAPI_WEBHOOK_SECRET, DIANA_INTEGRATION_TOKEN, QUEUE_TICK_SECRET ou CRON_SECRET, BETTER_AUTH_SECRET, BETTER_AUTH_URL, APP_URL. DATABASE_URL permanece só no servidor. O exemplo sem segredo está em .env.example.</p>
        <p>Repositório privado ancora-whatsapp-b na conta de Luís: esta ferramenta não conseguiu criá-lo. O código está neste aplicativo.</p>
      </section>
    </div>
  );
}
