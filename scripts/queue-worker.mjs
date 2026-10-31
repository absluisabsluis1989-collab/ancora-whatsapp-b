#!/usr/bin/env node
/**
 * Consome a fila com o painel fechado.
 * Não liga envio, não chama Z-API, não chama a DIANA e não chama modelo pago.
 * O servidor HTTP do aplicativo precisa estar no ar: este processo só acorda
 * POST /api/queue/tick. Trabalhos com horário futuro (revisão diurna) esperam
 * este processo, ou um agendador que chame o mesmo endereço.
 */
const base = (process.env.APP_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const secret = (process.env.QUEUE_TICK_SECRET || process.env.CRON_SECRET || "").trim();
const interval = Number(process.env.QUEUE_TICK_INTERVAL_MS || 15000);

if (!secret) {
  console.error("QUEUE_TICK_SECRET ausente. A fila não será consumida e nada foi inventado.");
  process.exit(1);
}

async function tick() {
  const response = await fetch(`${base}/api/queue/tick`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  const body = await response.text();
  console.log(`${new Date().toISOString()} ${response.status} ${body}`);
}

await tick();
const timer = setInterval(() => {
  tick().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
  });
}, Number.isFinite(interval) && interval >= 5000 ? interval : 15000);

process.on("SIGINT", () => {
  clearInterval(timer);
  process.exit(0);
});
process.on("SIGTERM", () => {
  clearInterval(timer);
  process.exit(0);
});
