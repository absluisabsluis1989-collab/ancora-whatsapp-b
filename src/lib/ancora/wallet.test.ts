import assert from "node:assert/strict";
import test from "node:test";
import { MemoryRepo } from "./memory-repo.ts";
import { buildRuntime, commitQuoteResult, handleIngress } from "./pipeline.ts";

const now = new Date("2026-10-30T18:00:00.000Z");

function runtime(source: "zapi" | "simulation") {
  return buildRuntime({ now, source, sendsEnabled: false, dianaEnabled: false, scenario: null });
}

test("carteira operacional só após cotação válida salva e vinculada", async () => {
  const repo = new MemoryRepo();
  await handleIngress(
    repo,
    {
      providerMessageId: "op-1",
      fromPhone: "5563991110001",
      body: "Quero plano de saúde em Palmas. Tenho 52 anos. Sou Ana Souza.",
      pushName: "Ana Souza",
    },
    runtime("zapi"),
  );
  const ana = await repo.findConversationByPhone("5563991110001");
  assert.ok(ana);
  assert.equal((await repo.listWallet()).length, 0);

  await commitQuoteResult(repo, ana.id, runtime("zapi"), {
    status: "completed",
    quoteId: "cot-ainda-nao",
    saved: false,
  });
  assert.equal((await repo.listWallet()).length, 0, "salva falsa não entra");

  await commitQuoteResult(repo, ana.id, runtime("zapi"), {
    status: "uncertain",
    quoteId: "cot-ainda-nao",
    saved: true,
  });
  assert.equal((await repo.listWallet()).length, 0, "status incerto não entra");

  await handleIngress(
    repo,
    {
      providerMessageId: "op-sem-vinculo",
      fromPhone: "5563991110009",
      body: "Quero plano de saúde em Palmas. Tenho 48 anos.",
    },
    runtime("zapi"),
  );
  const semVinculo = await repo.findConversationByPhone("5563991110009");
  assert.ok(semVinculo);
  await commitQuoteResult(repo, semVinculo.id, runtime("zapi"), {
    status: "completed",
    saved: true,
  });
  assert.equal((await repo.listWallet()).filter((row) => row.phone === "5563991110009").length, 0);

  await commitQuoteResult(repo, ana.id, runtime("zapi"), {
    status: "completed",
    quoteId: "cot-real-1",
    clientId: "cli-real-1",
    solicitationId: "sol-real-1",
    saved: true,
  });
  const once = await repo.listWallet();
  assert.equal(once.length, 1);
  assert.equal(once[0]?.assignedTo, "Luís");
  assert.equal(once[0]?.phone, "5563991110001");
  assert.equal(once[0]?.simulated, false);
  assert.equal(once[0]?.quoteId, "cot-real-1");

  await commitQuoteResult(repo, ana.id, runtime("zapi"), {
    status: "completed",
    quoteId: "cot-real-2",
    saved: true,
  });
  const kept = await repo.listWallet();
  assert.equal(kept.length, 1);
  assert.equal(kept[0]?.id, once[0]?.id);
  assert.equal(kept[0]?.quoteId, "cot-real-2");
  assert.equal(kept[0]?.assignedTo, "Luís");

  await handleIngress(
    repo,
    {
      providerMessageId: "op-2",
      fromPhone: "5563991110002",
      body: "Quero plano de saúde em Gurupi. Tenho 70 anos.",
    },
    runtime("zapi"),
  );
  const bruno = await repo.findConversationByPhone("5563991110002");
  assert.ok(bruno);
  await commitQuoteResult(repo, bruno.id, runtime("zapi"), {
    status: "completed",
    quoteId: "cot-real-3",
    saved: true,
  });
  const both = await repo.listWallet();
  assert.equal(both.length, 2);
  assert.equal(both.every((row) => row.assignedTo === "Luís" && row.simulated === false), true);

  await handleIngress(
    repo,
    {
      providerMessageId: "op-personal",
      fromPhone: "5563991110003",
      body: "Amor, vamos jantar em casa hoje?",
    },
    runtime("zapi"),
  );
  const personal = await repo.findConversationByPhone("5563991110003");
  assert.ok(personal);
  assert.equal(personal.lane, "personal");
  await repo.insertQuote({
    id: "q-personal",
    conversationId: personal.id,
    requestKey: "manual-personal",
    status: "not_connected",
    solicitationId: null,
    quoteId: null,
    clientId: null,
    savedConfirmed: false,
    simulated: false,
    missing: [],
    detail: "",
    createdAt: now.toISOString(),
  });
  await commitQuoteResult(repo, personal.id, runtime("zapi"), {
    status: "completed",
    quoteId: "cot-pessoal",
    saved: true,
  });
  assert.equal((await repo.listWallet()).length, 2);

  await handleIngress(
    repo,
    {
      providerMessageId: "sim-1",
      fromPhone: "5563991110099",
      body: "Quero plano de saúde em Palmas. Tenho 40 anos.",
    },
    runtime("simulation"),
  );
  const sim = await repo.findConversationByPhone("5563991110099");
  assert.ok(sim);
  await commitQuoteResult(repo, sim.id, runtime("simulation"), {
    status: "completed",
    quoteId: "cot-sim",
    saved: true,
  });
  assert.equal((await repo.listWallet()).length, 3);
  await repo.clearSimulation();
  const left = await repo.listWallet();
  assert.equal(left.length, 2);
  assert.equal(left.every((row) => row.simulated === false), true);
  assert.equal(left.some((row) => row.phone === "5563991110099"), false);
});
