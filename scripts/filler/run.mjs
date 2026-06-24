#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { run } from "./lib/runner.mjs";

// CLI entry point. Dry-run is the default; pass --live to actually submit
// (live submission is deferred to a later phase and intentionally unguarded here).

// Parse argv into an options object. Boolean flags stand alone; every other
// --flag must be followed by a real value, so a trailing flag or a following
// --option is a usage error rather than a silently swallowed value.
export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--live") args.live = true;
    else if (token === "--dry-run") args.dryRun = true;
    else if (token.startsWith("--")) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Missing value for ${token}`);
      }
      args[camelCase(token.slice(2))] = value;
      i++;
    }
  }
  return args;
}

// Convert a --kebab-case flag name to its camelCase option key.
function camelCase(name) {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// Read argv, validate required flags, run the engine, and map outcomes to exit
// codes: 2 for a usage error, 1 for a run failure.
function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
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
}

// Run the CLI only when invoked directly, so tests can import parseArgs safely.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
