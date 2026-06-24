import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Load and validate a form-filling config, resolving the target URL.
// The portal is described entirely by data here so the engine stays site-agnostic:
// "url" for a live site, or "formPath" (relative to the config) for a local form.
export async function loadConfig(configPath) {
  const raw = JSON.parse(await readFile(configPath, "utf8"));
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`config root must be a JSON object: ${configPath}`);
  }
  if (!Array.isArray(raw.fields)) {
    throw new Error(`config.fields must be an array: ${configPath}`);
  }
  if (raw.url != null && typeof raw.url !== "string") {
    throw new Error(`config.url must be a string: ${configPath}`);
  }
  if (raw.formPath != null && typeof raw.formPath !== "string") {
    throw new Error(`config.formPath must be a string: ${configPath}`);
  }
  const baseDir = path.dirname(path.resolve(configPath));
  let targetUrl;
  if (raw.url) {
    targetUrl = raw.url;
  } else if (raw.formPath) {
    targetUrl = pathToFileURL(path.resolve(baseDir, raw.formPath)).href;
  } else {
    throw new Error(`config must define "url" or "formPath": ${configPath}`);
  }
  return { ...raw, targetUrl, baseDir };
}
