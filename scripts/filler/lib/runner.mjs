import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { readRows } from "./spreadsheet.mjs";
import { loadConfig } from "./config.mjs";
import { loadLedger, saveLedger, isDone, record } from "./ledger.mjs";
import { fillRow } from "./filler.mjs";

// Orchestrate a run: read the sheet, drive a headless browser per row, and
// persist the ledger after each row. Dry-run by default (no live submission).
export async function run({
  configPath,
  sheetPath,
  dryRun = true,
  evidenceDir,
  ledgerPath,
  keyColumn,
  assetsDir,
}) {
  const config = await loadConfig(configPath);
  const rows = await readRows(sheetPath);
  const sheetDir = path.dirname(path.resolve(sheetPath));
  evidenceDir = evidenceDir || path.join(config.baseDir, "evidence");
  ledgerPath = ledgerPath || path.join(sheetDir, "run.ledger.json");
  assetsDir = assetsDir || sheetDir;
  keyColumn = keyColumn || config.keyColumn;
  await mkdir(evidenceDir, { recursive: true });

  const ledger = await loadLedger(ledgerPath);
  const summary = { total: rows.length, filled: 0, skipped: 0, errors: 0 };

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowKey = keyColumn && row[keyColumn] ? row[keyColumn] : String(i + 1);
      if (isDone(ledger, rowKey)) {
        summary.skipped++;
        continue;
      }
      try {
        const { screenshotPath } = await fillRow(page, config, row, {
          dryRun,
          evidenceDir,
          rowKey,
          assetsDir,
        });
        record(ledger, rowKey, dryRun ? "filled" : "submitted", {
          at: new Date().toISOString(),
          evidence: screenshotPath,
        });
        summary.filled++;
      } catch (err) {
        record(ledger, rowKey, "error", { at: new Date().toISOString(), message: err.message });
        summary.errors++;
      }
      await saveLedger(ledgerPath, ledger);
    }
  } finally {
    await browser.close();
  }
  return { summary, ledgerPath, evidenceDir };
}
