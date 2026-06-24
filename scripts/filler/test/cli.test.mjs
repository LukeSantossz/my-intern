import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../run.mjs";

test("parse_args_reads_flag_values_and_booleans", () => {
  assert.deepEqual(parseArgs(["--config", "c.json", "--sheet", "d.csv", "--dry-run"]), {
    config: "c.json",
    sheet: "d.csv",
    dryRun: true,
  });
});

test("parse_args_rejects_flag_without_value", () => {
  assert.throws(() => parseArgs(["--config", "--sheet", "d.csv"]), /Missing value/);
  assert.throws(() => parseArgs(["--config"]), /Missing value/);
});
