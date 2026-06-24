import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../lib/config.mjs";

// Run fn with a temp config file containing the given raw JSON text.
async function withConfig(contents, fn) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "filler-config-"));
  try {
    const configPath = path.join(tmp, "config.json");
    await writeFile(configPath, contents);
    return await fn(configPath);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

test("rejects_non_object_config_root", async () => {
  await withConfig("null", (p) => assert.rejects(loadConfig(p), /must be a JSON object/));
  await withConfig("[]", (p) => assert.rejects(loadConfig(p), /must be a JSON object/));
  await withConfig("42", (p) => assert.rejects(loadConfig(p), /must be a JSON object/));
});

test("rejects_non_string_target_fields", async () => {
  await withConfig(JSON.stringify({ fields: [], url: 123 }), (p) =>
    assert.rejects(loadConfig(p), /url must be a string/),
  );
  await withConfig(JSON.stringify({ fields: [], formPath: 5 }), (p) =>
    assert.rejects(loadConfig(p), /formPath must be a string/),
  );
});

test("rejects_missing_fields_array", async () => {
  await withConfig(JSON.stringify({ url: "https://example.test" }), (p) =>
    assert.rejects(loadConfig(p), /fields must be an array/),
  );
});

test("accepts_a_valid_config_and_resolves_target_url", async () => {
  await withConfig(JSON.stringify({ fields: [], url: "https://example.test/form" }), async (p) => {
    const config = await loadConfig(p);
    assert.equal(config.targetUrl, "https://example.test/form");
  });
});
