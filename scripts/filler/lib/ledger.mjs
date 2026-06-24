import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";

// A run ledger holds one entry per processed row, keyed by a stable row key, so
// re-runs can skip rows already completed (idempotency) and resume after a crash.
export async function loadLedger(ledgerPath) {
  try {
    const data = JSON.parse(await readFile(ledgerPath, "utf8"));
    const base = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    const entries =
      base.entries && typeof base.entries === "object" && !Array.isArray(base.entries)
        ? base.entries
        : {};
    return { ...base, entries };
  } catch (error) {
    // A missing ledger (first run) or unparseable file legitimately starts empty;
    // any other fault (permissions, EISDIR, ...) is real and must not be masked.
    if (error?.code === "ENOENT" || error?.name === "SyntaxError") {
      return { entries: {} };
    }
    throw error;
  }
}

// Persist the ledger atomically: write a temp file then rename over the target,
// so an interrupted run never leaves a half-written ledger and resume stays safe.
export async function saveLedger(ledgerPath, ledger) {
  const resolved = path.resolve(ledgerPath);
  const dir = path.dirname(resolved);
  const tmp = path.join(dir, `.${path.basename(resolved)}.tmp`);
  await mkdir(dir, { recursive: true });
  await writeFile(tmp, JSON.stringify(ledger, null, 2));
  await rename(tmp, resolved);
}

// True when a row's entry exists and reached a terminal success status.
export function isDone(ledger, key) {
  const entry = ledger.entries[key];
  return !!entry && (entry.status === "filled" || entry.status === "submitted");
}

// Upsert a row's entry with the given status and any extra metadata.
export function record(ledger, key, status, extra = {}) {
  ledger.entries[key] = { key, status, ...extra };
  return ledger.entries[key];
}
