import path from "node:path";
import { stat } from "node:fs/promises";

// Resolve a per-row file path: absolute as-is, otherwise relative to assetsDir.
export function resolveAssetPath(value, assetsDir) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(assetsDir, value);
}

// Fill one row into an already-open page. Dry-run by default: it fills and
// screenshots but never clicks submit, so it cannot post to a live site.
// Throws on a missing required field or file so the caller can record an error.
export async function fillRow(page, config, row, { dryRun = true, evidenceDir, rowKey, assetsDir }) {
  await page.goto(config.targetUrl);
  if (config.readySelector) await page.waitForSelector(config.readySelector);

  for (const field of config.fields) {
    const value = row[field.column] ?? "";
    if (field.required && value === "") {
      throw new Error(`missing required field "${field.column}"`);
    }
    await page.fill(field.selector, String(value));
  }

  if (config.fileField) {
    const filePath = resolveAssetPath(row[config.fileField.column], assetsDir);
    if (config.fileField.required && !filePath) {
      throw new Error(`missing required file column "${config.fileField.column}"`);
    }
    if (filePath) {
      await stat(filePath); // throws if the attachment does not exist
      await page.setInputFiles(config.fileField.selector, filePath);
    }
  }

  let screenshotPath = null;
  if (evidenceDir) {
    screenshotPath = path.join(evidenceDir, `${sanitizeKey(rowKey)}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  if (!dryRun) {
    if (!config.submitSelector) throw new Error("submitSelector is required for a live submit");
    await page.click(config.submitSelector);
  }
  return { screenshotPath };
}

function sanitizeKey(key) {
  return String(key).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 100) || "row";
}
