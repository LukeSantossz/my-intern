#!/usr/bin/env node
import { run } from "./lib/runner.mjs";

// CLI entry point. Dry-run is the default; pass --live to actually submit
// (live submission is deferred to a later phase and intentionally unguarded here).
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--live") args.live = true;
    else if (token === "--dry-run") args.dryRun = true;
    else if (token.startsWith("--")) args[camelCase(token.slice(2))] = argv[++i];
  }
  return args;
}

function camelCase(name) {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

const args = parseArgs(process.argv.slice(2));
if (!args.config || !args.sheet) {
  console.error(
    "Usage: node run.mjs --config <config.json> --sheet <data.(csv|xlsx)> " +
      "[--dry-run|--live] [--evidence-dir <dir>] [--ledger <file>] [--key-column <name>] [--assets-dir <dir>]",
  );
  process.exit(2);
}

run({
  configPath: args.config,
  sheetPath: args.sheet,
  dryRun: !args.live,
  evidenceDir: args.evidenceDir,
  ledgerPath: args.ledger,
  keyColumn: args.keyColumn,
  assetsDir: args.assetsDir,
})
  .then((result) => {
    console.log(
      `Done: ${JSON.stringify(result.summary)}\nLedger: ${result.ledgerPath}\nEvidence: ${result.evidenceDir}`,
    );
  })
  .catch((err) => {
    console.error("Run failed:", err.message);
    process.exit(1);
  });
