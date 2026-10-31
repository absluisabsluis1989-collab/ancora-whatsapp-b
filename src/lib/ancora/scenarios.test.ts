import assert from "node:assert/strict";
import test from "node:test";
import { runAllScenarios } from "./scenarios.ts";

test("cenários simulados do ambiente B", async () => {
  const reports = await runAllScenarios();
  const failed = reports.flatMap((report) =>
    report.checks.filter((item) => !item.pass).map((item) => `${report.id}: ${item.name} — ${item.detail}`),
  );
  assert.deepEqual(failed, []);
  assert.equal(reports.every((report) => report.modelValidated === false), true);
  assert.equal(reports.every((report) => report.whatsappValidated === false), true);
  assert.equal(reports.every((report) => report.dianaValidated === false), true);
});
