import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run, resolveRowKey } from "../lib/runner.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(here, "..", "fixtures", "fixture.config.json");

async function setup(makeCsv) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "filler-run-"));
  const img = path.join(tmp, "img.png");
  await writeFile(img, Buffer.from("PNGDATA-nonzero"));
  const sheet = path.join(tmp, "data.csv");
  await writeFile(sheet, makeCsv(img));
  return { tmp, img, sheet, ledger: path.join(tmp, "run.ledger.json"), evidence: path.join(tmp, "evi") };
}

test("ledger_is_written_and_idempotent", async () => {
  const { tmp, sheet, ledger, evidence } = await setup(
    (img) => `id,nome,email,anexo_path\n1,Ana,a@e.com,${img}\n2,Bea,b@e.com,${img}\n`,
  );
  try {
    const r1 = await run({ configPath, sheetPath: sheet, dryRun: true, evidenceDir: evidence, ledgerPath: ledger });
    assert.equal(r1.summary.filled, 2);
    assert.equal(r1.summary.skipped, 0);
    const led = JSON.parse(await readFile(ledger, "utf8"));
    assert.equal(Object.keys(led.entries).length, 2);

    const r2 = await run({ configPath, sheetPath: sheet, dryRun: true, evidenceDir: evidence, ledgerPath: ledger });
    assert.equal(r2.summary.skipped, 2);
    assert.equal(r2.summary.filled, 0);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("resolve_row_key_preserves_falsy_key_values", () => {
  // A key column value of 0 is valid and must not collapse to the row number.
  assert.equal(resolveRowKey({ id: 0 }, "id", 5), "0");
  assert.equal(resolveRowKey({ id: "abc" }, "id", 0), "abc");
  // Empty or absent keys fall back to the 1-based row number.
  assert.equal(resolveRowKey({ id: "" }, "id", 5), "6");
  assert.equal(resolveRowKey({}, undefined, 2), "3");
});

test("row_error_is_recorded_and_batch_continues", async () => {
  const { tmp, sheet, ledger, evidence } = await setup(
    (img) => `id,nome,email,anexo_path\n1,Ana,a@e.com,\n2,Bea,b@e.com,${img}\n`,
  );
  try {
    const r = await run({ configPath, sheetPath: sheet, dryRun: true, evidenceDir: evidence, ledgerPath: ledger });
    assert.equal(r.summary.errors, 1);
    assert.equal(r.summary.filled, 1);
    const led = JSON.parse(await readFile(ledger, "utf8"));
    assert.equal(led.entries["1"].status, "error");
    assert.equal(led.entries["2"].status, "filled");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
