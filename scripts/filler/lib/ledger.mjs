import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// A run ledger holds one entry per processed row, keyed by a stable row key, so
// re-runs can skip rows already completed (idempotency) and resume after a crash.
export async function loadLedger(ledgerPath) {
  try {
    const data = JSON.parse(await readFile(ledgerPath, "utf8"));
    return data && typeof data === "object" && data.entries ? data : { entries: {} };
  } catch {
    return { entries: {} };
  }
}

export async function saveLedger(ledgerPath, ledger) {
  await mkdir(path.dirname(path.resolve(ledgerPath)), { recursive: true });
  await writeFile(ledgerPath, JSON.stringify(ledger, null, 2));
}

export function isDone(ledger, key) {
  const entry = ledger.entries[key];
  return !!entry && (entry.status === "filled" || entry.status === "submitted");
}

export function record(ledger, key, status, extra = {}) {
  ledger.entries[key] = { key, status, ...extra };
  return ledger.entries[key];
}
