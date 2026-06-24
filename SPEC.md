# SPEC: feat(filler): site-agnostic spreadsheet-driven form-filling engine (dry-run, hermetic)

## Problem

An intern repeatedly fills a login-protected official web form from spreadsheet data, attaching a per-row image or a predefined message, and this must be automated to run entirely in Claude Code on the web (no local execution); but work cannot safely start against the live portal until a tested, site-agnostic engine exists.

## Design Decision

Build a configuration-driven form-filling engine in Node.js on the already-available Playwright (headless Chromium, verified working in the cloud sandbox by a feasibility spike). The engine reads rows from an .xlsx/.csv file and, for each row, drives a headless browser to fill fields and attach a file in a target HTML form described entirely by an external config (selectors plus a column-to-field mapping). It runs in dry-run by default: it fills and captures a screenshot but never submits, and records every row in an idempotent execution ledger. The real portal's URL, selectors, login, and live submission are intentionally deferred to later phases; this engine is validated hermetically against a local fixture form so it depends on neither the live site nor the network.

## Alternatives Considered

1. Python + Playwright/Selenium. Rejected for the first increment: the Node Playwright runtime and the Chromium build are already installed and proven by the spike, while the Python bindings, openpyxl, and pandas are absent; staying in Node avoids extra setup and an unproven path.
2. Build directly against the live portal, skipping the fixture. Rejected: it couples every test to a credentialed official site (flaky, unsafe, and possibly against its terms during development) and blocks all progress until site access and credentials are arranged; a fixture-tested engine makes safe progress now.
3. Hardcode the field mapping in code. Rejected: the portal's fields are not yet known and may change; an external config keeps the engine site-agnostic and lets the real portal plug in during Phase 0/2 without code changes.

## Scope

- Includes:
  - Spreadsheet reader: parse rows and headers from .xlsx and .csv into row objects keyed by header.
  - Config-driven filler (headless Chromium via Playwright, `--no-sandbox`): open the configured form, fill mapped fields from a row, attach the configured per-row file.
  - Dry-run mode (default): fill and screenshot into an evidence directory; never submit and never call a network endpoint.
  - Execution ledger (JSON): one record per row (key, status, timestamp, evidence path, message); idempotent re-runs skip rows already done; a single failing row is logged and does not abort the batch.
  - Hermetic fixtures and automated tests covering every Acceptance Criterion (local fixture HTML form, sample sheet, dummy attachment; no live site, no network).
  - Project scaffolding: `package.json`, `.gitignore` (node_modules, evidence output, ledger), and a documented browser setup step (`npx playwright install chromium`).
- Does NOT include:
  - The real portal's URL, selectors, or field map.
  - Login/authentication and any credential handling.
  - Real form submission to any live site.
  - Image/message selection logic beyond resolving a per-row file path from a column.
  - The `.claude/` orchestration skill/command and any scheduled Routine.

## Acceptance Criteria

- `reads_all_rows_from_sample_spreadsheet`: a sample sheet (both .csv and .xlsx) with N data rows yields N row objects keyed by header.
- `fills_mapped_fields_from_row`: each column mapped in the config is written into the corresponding fixture-form field, asserted via the DOM.
- `attaches_configured_file_for_row`: the configured file input receives the row's resolved file; the fixture reports the filename and a nonzero size.
- `dry_run_captures_screenshot_and_does_not_submit`: in dry-run the engine writes one screenshot per row and the fixture's submit handler is never invoked.
- `ledger_is_written_and_idempotent`: after a run the ledger holds one record per processed row; a second run reprocesses none of the already-done rows.
- `row_error_is_recorded_and_batch_continues`: a row missing a required field or file is recorded as `error` and the remaining rows still process.

## Reproducibility

- Setup (once per environment): `npm ci`, then ensure the browser with `npx playwright install chromium` (cached in `/opt/pw-browsers`).
- Test suite: `npm test` — creates fixtures in a temp directory, runs the engine in dry-run, and asserts every criterion; no network.
- Manual dry-run: `node scripts/filler/run.mjs --config scripts/filler/fixtures/fixture.config.json --sheet scripts/filler/fixtures/sample.csv --dry-run` produces screenshots under the evidence directory and writes the ledger.
- Versions: Node v22.x, Playwright 1.56.x, Chromium 141 (build 1194), verified present.

## Risks and Assumptions

- Assumption: the real portal is a standard HTML form reachable by CSS/text selectors; this is validated against the live site in Phase 0 before wiring it in. A heavy single-page app or non-standard widgets would require adjusting the fill strategy, which would revise the config schema, not the engine core.
- Assumption: a spreadsheet-reader dependency is acceptable; the choice (for example SheetJS `xlsx` or `exceljs`) is justified in the PR, version-pinned, and `node_modules` stays gitignored.
- Assumption: the environment keeps egress to `cdn.playwright.dev` (verified) and the npm registry (allowlisted) for setup.
- Deferred, and therefore outside this spec's risk: login, credentials, and live submission arrive in a later phase behind a preview-then-approve gate; this engine cannot submit to any real site.
