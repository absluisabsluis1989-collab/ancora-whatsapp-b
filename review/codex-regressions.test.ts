import test from "node:test";
import assert from "node:assert/strict";
import { extractAges } from "../src/lib/ancora/policy.ts";
import { buildRuntime, handleIngress, drain } from "../src/lib/ancora/pipeline.ts";
import { MemoryRepo } from "../src/lib/ancora/memory-repo.ts";

test("idades iguais representam duas pessoas", () => {
  assert.deepEqual(extractAges("30 anos e 30 anos"), [30, 30]);
});
test("resposta com idade isolada é aproveitada", () => {
  assert.deepEqual(extractAges("68"), [68]);
});
test("bebê de três meses tem zero anos completos", () => {
  assert.deepEqual(extractAges("filho de 3 meses"), [0]);
});
test("runtime preserva o adaptador de saída recebido", () => {
  const deliver = async () => "accepted" as const;
  const runtime = buildRuntime({ now: new Date(), source: "zapi", sendsEnabled: true, deliver });
  assert.equal(runtime.deliver, deliver);
});
test("dois consumidores não executam a mesma saída duas vezes", async () => {
  const base = new MemoryRepo();
  const initial = {
    now: new Date("2026-10-31T15:00:00Z"), source: "zapi" as const,
    sendsEnabled: false, dianaEnabled: false, selfPhone: "63992731001", scenario: null,
  };
  await handleIngress(base, {
    providerMessageId: "review-only-message", connectedPhone: "63992731001",
    fromPhone: "5563000000001", body: "Quero cotação sênior Palmas 68 anos",
  }, initial);
  for (const job of base.jobs) {
    job.status = "pending"; job.lockedAt = null; job.attempts = 0;
  }
  base.parts = [];
  base.messages = base.messages.filter(message => message.direction === "inbound");
  // Retornos independentes por valor, como as linhas mapeadas pelo adaptador SQL.
  // Este teste controla o repositório; não é uma validação do Neon real.
  const repo = new Proxy(base, {
    get(target, property) {
      if (property === "listJobs") return async () => structuredClone(await target.listJobs());
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  let deliveries = 0;
  const runtime = {
    ...initial, sendsEnabled: true,
    // Transporte estritamente local. Nenhuma Z-API, telefone ou rede é chamada.
    deliver: async () => { deliveries++; return "accepted" as const; },
  };
  await Promise.all([drain(repo, runtime, 1), drain(repo, runtime, 1)]);
  assert.equal(base.parts.length, 1);
  assert.equal(deliveries, 1);
});

test("repetição recupera trabalho se a gravação da fila falhar depois da mensagem", async () => {
  const base = new MemoryRepo();
  const runtime = {
    now: new Date("2026-10-31T15:00:00Z"), source: "zapi" as const,
    sendsEnabled: false, dianaEnabled: false, selfPhone: "63992731001", scenario: null,
  };
  const event = {
    providerMessageId: "review-only-crash", connectedPhone: "63992731001",
    fromPhone: "5563000000002", body: "Quero cotação sênior Palmas 68 anos",
  };
  let crash = true;
  const repo = new Proxy(base, {
    get(target, property) {
      if (property === "insertJob") return async (row: Parameters<MemoryRepo["insertJob"]>[0]) => {
        if (crash) { crash = false; throw new Error("simulated crash before job"); }
        return target.insertJob(row);
      };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  await assert.rejects(handleIngress(repo, event, runtime), /simulated crash/);
  assert.equal(base.messages.length, 1);
  await handleIngress(repo, event, runtime);
  assert.ok(base.jobs.length > 0 || base.messages[0].status === "processed",
    "entrada confirmada precisa manter processamento recuperável");
});
