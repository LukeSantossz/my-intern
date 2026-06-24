import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadLedger, saveLedger, record } from "../lib/ledger.mjs";

async function tmpdir() {
  return mkdtemp(path.join(os.tmpdir(), "filler-ledger-"));
}

test("loads_empty_ledger_when_file_is_missing", async () => {
  const dir = await tmpdir();
  try {
    assert.deepEqual(await loadLedger(path.join(dir, "absent.json")), { entries: {} });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("falls_back_to_empty_on_malformed_json", async () => {
  const dir = await tmpdir();
  try {
    const p = path.join(dir, "led.json");
    await writeFile(p, "{ not valid json");
    assert.deepEqual(await loadLedger(p), { entries: {} });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("normalizes_malformed_entries_shape", async () => {
  const dir = await tmpdir();
  try {
    const p = path.join(dir, "led.json");
    await writeFile(p, JSON.stringify({ entries: [1, 2, 3] }));
    const led = await loadLedger(p);
    assert.deepEqual(led.entries, {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("surfaces_unexpected_read_errors", async () => {
  const dir = await tmpdir();
  try {
    // Reading a directory as a file fails with EISDIR; that is not a
    // missing-file case and must not be masked as an empty ledger.
    await assert.rejects(loadLedger(dir), (err) => err.code === "EISDIR");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("saves_ledger_and_leaves_no_temp_file_behind", async () => {
  const dir = await tmpdir();
  try {
    const p = path.join(dir, "sub", "run.ledger.json");
    const led = { entries: {} };
    record(led, "1", "filled", { at: "t" });
    await saveLedger(p, led);
    const reloaded = JSON.parse(await readFile(p, "utf8"));
    assert.equal(reloaded.entries["1"].status, "filled");
    const leftovers = (await readdir(path.dirname(p))).filter((f) => f.includes(".tmp"));
    assert.deepEqual(leftovers, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
