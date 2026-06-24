import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdtemp, writeFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../lib/config.mjs";
import { fillRow } from "../lib/filler.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(here, "..", "fixtures", "fixture.config.json");

let browser;
let page;
let tmp;
let imgPath;

before(async () => {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  page = await browser.newPage();
  tmp = await mkdtemp(path.join(os.tmpdir(), "filler-fill-"));
  imgPath = path.join(tmp, "foto.png");
  await writeFile(imgPath, Buffer.from("PNGDATA-nonzero"));
});

after(async () => {
  await browser?.close();
  await rm(tmp, { recursive: true, force: true });
});

test("fills_mapped_fields_from_row", async () => {
  const config = await loadConfig(configPath);
  const row = { nome: "Ana Souza", email: "ana@example.com", anexo_path: imgPath };
  await fillRow(page, config, row, { dryRun: true, evidenceDir: tmp, rowKey: "r1", assetsDir: tmp });
  assert.equal(await page.inputValue("#nome"), "Ana Souza");
  assert.equal(await page.inputValue("#email"), "ana@example.com");
});

test("attaches_configured_file_for_row", async () => {
  const config = await loadConfig(configPath);
  const row = { nome: "Bea", email: "b@e.com", anexo_path: imgPath };
  await fillRow(page, config, row, { dryRun: true, evidenceDir: tmp, rowKey: "r2", assetsDir: tmp });
  const info = await page.textContent("#fileinfo");
  assert.match(info, /^foto\.png:\d+$/);
  assert.ok(!info.endsWith(":0"));
});

test("dry_run_captures_screenshot_and_does_not_submit", async () => {
  const config = await loadConfig(configPath);
  const row = { nome: "Caio", email: "c@e.com", anexo_path: imgPath };
  const { screenshotPath } = await fillRow(page, config, row, {
    dryRun: true,
    evidenceDir: tmp,
    rowKey: "r3",
    assetsDir: tmp,
  });
  assert.equal(await page.textContent("#submitted"), "");
  await stat(screenshotPath); // throws if the screenshot was not written
});
